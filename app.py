from flask import Flask, render_template, request, redirect, url_for, jsonify, session
from functools import wraps
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
import ollama
import json
import re

from db import (
    init_db, create_user, get_user_by_email, get_user_by_id,
    add_score, get_scores, save_schedule, get_latest_schedule
)

app = Flask(__name__)
app.secret_key = "dev-change-this"  # hackathon OK; change for real production


@app.before_request
def require_login():
    allowed_routes = {"login", "register", "static"}
    if request.endpoint in allowed_routes:
        return

    if not session.get("user_id"):
        return redirect(url_for("login"))


init_db()


def current_user():
    uid = session.get("user_id")
    return get_user_by_id(uid) if uid else None


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get("user_id"):
            return redirect(url_for("login"))
        return fn(*args, **kwargs)
    return wrapper


@app.route("/")
def home():
    return render_template("home.html", user=current_user(), subtitle="Quick signals, tracked over time")


@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        if not name or not email or not password:
            return render_template("register.html", error="Please fill out all fields.")
        if get_user_by_email(email):
            return render_template("register.html", error="Email already registered.")
        pw_hash = generate_password_hash(password)
        create_user(name, email, pw_hash, datetime.utcnow().isoformat())
        user = get_user_by_email(email)
        session["user_id"] = user["id"]
        return redirect(url_for("dashboard"))
    return render_template("register.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        user = get_user_by_email(email)
        if not user or not check_password_hash(user["password_hash"], password):
            return render_template("login.html", error="Invalid email or password.")
        session["user_id"] = user["id"]
        return redirect(url_for("dashboard"))
    return render_template("login.html")


@app.route("/logout")
def logout():
    session.pop("user_id", None)
    return redirect(url_for("home"))


@app.route("/tests")
@login_required
def tests():
    # Only one Stroop test here
    games = [
        {"id": "stroop",
            "name": "Color Interference (Stroop)", "domain": "Executive Function", "minutes": 2},
        {"id": "recall", "name": "Five-Word Recall",
            "domain": "Memory", "minutes": 2},
        {"id": "orientation", "name": "Orientation Quickcheck",
            "domain": "Orientation", "minutes": 1},
        {"id": "tapping", "name": "Finger Tapping",
            "domain": "Attention", "minutes": 1},
        {"id": "fluency", "name": "Speech Fluency",
            "domain": "Language", "minutes": 1},
    ]
    return render_template("tests.html", games=games, user=current_user(), subtitle="Assessment tests")


@app.route("/game/typing")
@login_required
def typing_test():
    return render_template("typing_test.html", user=current_user(), subtitle="Typing Assessment")


@app.route("/practice/typing")
@login_required
def practice_typing():
    return render_template("typing_test.html", user=current_user(), subtitle="Typing Speed Practice")


@app.route("/game/stroop")
@login_required
def game_stroop():
    return render_template("game_stroop.html", user=current_user(), subtitle="Color Interference")


@app.route("/game/recall")
@login_required
def game_recall():
    return render_template("game_recall.html", user=current_user(), subtitle="Five-Word Recall")


@app.route("/game/orientation")
@login_required
def game_orientation():
    return render_template("game_orientation.html", user=current_user(), subtitle="Orientation Quickcheck")


@app.route("/game/tapping")
@login_required
def game_tapping():
    return render_template("game_tapping.html", user=current_user(), subtitle="Finger Tapping")


@app.route("/game/fluency")
@login_required
def game_fluency():
    return render_template("game_fluency.html", user=current_user(), subtitle="Speech Fluency")


@app.route("/game/visual_puzzle")
@login_required
def visual_puzzle():
    return render_template("game_visual_puzzle.html", user=current_user(), subtitle="Visual Puzzle")


@app.route("/practice/trails")
@login_required
def trails():
    return render_template("game_trails.html", user=current_user(), subtitle="Trails Practice")


@app.route("/practice/visual_puzzle")
@login_required
def practice_visual_puzzle():
    return render_template("game_visual_puzzle.html", user=current_user(), subtitle="Visual Puzzle Practice")


@app.route("/practice/stroop")
@login_required
def practice_stroop():
    return render_template("stroop.html", user=current_user(), subtitle="Stroop Practice")


@app.route("/practice/recall")
@login_required
def practice_recall():
    return render_template("game_recall.html", user=current_user(), subtitle="Word Recall Practice")


@app.route("/practice/tapping")
@login_required
def practice_tapping():
    return render_template("game_tapping.html", user=current_user(), subtitle="Finger Tapping Practice")


@app.route("/practice/orientation")
@login_required
def practice_orientation():
    return render_template("game_orientation.html", user=current_user(), subtitle="Orientation Practice")


@app.route("/practice")
@login_required
def practice():
    games = [
        {"id": "stroop", "name": "Stroop Practice",
            "domain": "Executive Function", "minutes": 2},
        {"id": "typing", "name": "Typing Speed",
            "domain": "Attention", "minutes": 2},
        {"id": "visual_puzzle", "name": "Visual Puzzle",
            "domain": "Visualization", "minutes": 2},
        {"id": "trails", "name": "Trails",
            "domain": "Pattern Identification", "minutes": 2}
    ]
    return render_template("practice.html", games=games, user=current_user(), subtitle="Personalized training")


@app.route("/dashboard")
@login_required
def dashboard():
    user = current_user()
    if not user:
        session.pop("user_id", None)
        return redirect(url_for("login"))
    scores = get_scores(user["id"], limit=30)
    latest_by_domain = {}
    for s in scores:
        if s["domain"] not in latest_by_domain:
            latest_by_domain[s["domain"]] = s

    return render_template(
        "dashboard.html",
        user=user,
        scores=scores,
        latest_by_domain=latest_by_domain,
        subtitle="Your results"
    )


@app.post("/api/score")
@login_required
def api_score():
    import json
    user = current_user()
    payload = request.get_json(force=True)
    details = json.dumps(payload.get("details", {})
                         ) if payload.get("details") else None
    add_score(user["id"], payload.get("game"), payload.get(
        "domain"), payload.get("value"), datetime.utcnow().isoformat(), details)
    return jsonify({"ok": True})


@app.get("/api/typing-text")
@login_required
def get_typing_text():
    """Generate random text from LLM for typing test."""
    try:
        # Use Ollama to generate text via local LLM
        response = ollama.generate(
            model="mistral",  # or "llama2", "neural-chat", etc.
            prompt="Generate a single short sentence (15-30 words) about a random topic for a typing test. Just the sentence, nothing else.",
            stream=False
        )

        text = response['response'].strip()

        # Fallback if LLM fails to generate good text
        if not text or len(text) < 10:
            text = "Neuroplasticity is the ability of the brain to form and reorganize synaptic connections, especially in response to learning or experience or following injury."

        return jsonify({
            "text": text,
            "length": len(text)
        })
    except Exception as e:
        print(f"LLM Error: {e}")
        # Fallback text if LLM is unavailable
        fallback_texts = [
            "Neuroplasticity is the ability of the brain to form and reorganize synaptic connections, especially in response to learning or experience or following injury.",
            "The ability to focus deeply on demanding tasks is becoming increasingly rare and valuable in our distracted world.",
            "Cognitive training has been shown to improve various aspects of mental performance including memory, attention, and processing speed.",
            "Modern technology offers us unprecedented opportunities to measure and track our cognitive abilities over time.",
            "Regular practice and consistent effort are the foundations of skill development and cognitive improvement.",
        ]
        import random
        text = random.choice(fallback_texts)
        return jsonify({
            "text": text,
            "length": len(text)
        })


@app.get("/api/recall-words")
@login_required
def get_recall_words():
    """Generate 5 random words for recall game."""
    try:
        # Use Ollama to generate words via local LLM
        response = ollama.generate(
            model="mistral",
            prompt="Generate exactly 5 random common English words separated by commas. Just the words, nothing else. Example format: cat, book, tree, water, light",
            stream=False
        )

        words_str = response['response'].strip()
        words = [w.strip().lower() for w in words_str.split(',')][:5]

        # Fallback if we don't get exactly 5 words
        if len(words) < 5:
            import random
            fallback_words = [
                ["elephant", "crystal", "mountain", "piano", "harbor"],
                ["garden", "thunder", "silver", "whisper", "anchor"],
                ["canvas", "forest", "marble", "silence", "beacon"],
                ["island", "symphony", "pearl", "venture", "wisdom"],
                ["bridge", "twilight", "emerald", "rhythm", "horizon"],
            ]
            words = random.choice(fallback_words)

        return jsonify({
            "words": words[:5]
        })
    except Exception as e:
        print(f"LLM Error: {e}")
        # Fallback words if LLM is unavailable
        import random
        fallback_words = [
            ["elephant", "crystal", "mountain", "piano", "harbor"],
            ["garden", "thunder", "silver", "whisper", "anchor"],
            ["canvas", "forest", "marble", "silence", "beacon"],
            ["island", "symphony", "pearl", "venture", "wisdom"],
            ["bridge", "twilight", "emerald", "rhythm", "horizon"],
        ]
        words = random.choice(fallback_words)
        return jsonify({
            "words": words
        })


@app.route("/schedule")
@login_required
def schedule():
    user = current_user()
    scores = get_scores(user["id"], limit=100)

    # Check if user has any assessments
    has_assessments = len(scores) > 0

    # Get latest schedule
    latest_schedule = get_latest_schedule(user["id"])
    current_schedule = None
    schedule_json = {}

    if latest_schedule:
        current_schedule = latest_schedule
        schedule_data_str = latest_schedule["schedule_data"]
        try:
            schedule_json = json.loads(schedule_data_str) if isinstance(
                schedule_data_str, str) else schedule_data_str
        except:
            schedule_json = {}

    return render_template(
        "schedule.html",
        user=user,
        has_assessments=has_assessments,
        current_schedule=current_schedule,
        schedule_json=schedule_json,
        subtitle="Personalized Training Schedule"
    )


@app.post("/api/generate-schedule")
@login_required
def generate_schedule_api():
    user = current_user()
    payload = request.get_json(force=True)
    days = payload.get("days", 7)

    scores = get_scores(user["id"], limit=100)

    # Calculate domain averages
    domain_scores = {}
    for score in scores:
        domain = score["domain"]
        if domain not in domain_scores:
            domain_scores[domain] = []
        domain_scores[domain].append(score["value"])

    domain_averages = {domain: sum(scores) / len(scores)
                       for domain, scores in domain_scores.items()}

    # Build prompt for LLM
    domains_info = "\n".join(
        [f"- {domain}: Average Score {avg:.2f}/100" for domain, avg in domain_averages.items()])

    prompt = f"""You are a cognitive training coach. Based on these assessment scores, create a {days}-day personalized training schedule with a checklist of tasks.

User's Assessment Scores:
{domains_info}

Available games:
- typing (Attention) - tests typing speed and accuracy
- visual_puzzle (Visualization) - tests spatial reasoning
- stroop (Executive Function) - tests cognitive control
- recall (Memory) - tests word memory
- tapping (Attention) - tests finger dexterity
- orientation (Orientation) - tests spatial awareness

For each day, recommend 2-5 random games (you decide the number). Focus on improving weaker domains.

Create a JSON schedule with this exact format:
{{
  "days": [
    {{
      "focus": "Domain or goal (e.g. Improve Memory)",
      "description": "Brief description of what to work on today",
      "games": [
        {{"id": "game_id", "name": "Game Name"}}
      ]
    }}
  ]
}}

IMPORTANT:
- Return ONLY the JSON object, no other text
- games array should have 2-5 items per day
- Use actual game ids: typing, visual_puzzle, stroop, recall, tapping, orientation
- Focus on user's weaker domains based on scores"""

    try:
        response = ollama.generate(
            model="mistral",
            prompt=prompt,
            stream=False
        )

        schedule_text = response['response'].strip()

        # Try to parse JSON from response
        try:
            schedule_data = json.loads(schedule_text)
        except json.JSONDecodeError:
            # Try to extract JSON if wrapped in text
            json_match = re.search(
                r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', schedule_text)
            if json_match:
                try:
                    schedule_data = json.loads(json_match.group())
                except:
                    schedule_data = generate_fallback_schedule(
                        days, domain_averages)
            else:
                schedule_data = generate_fallback_schedule(
                    days, domain_averages)

        # Save schedule
        save_schedule(user["id"], json.dumps(schedule_data),
                      days, datetime.utcnow().isoformat())

        return jsonify({
            "ok": True,
            "schedule": schedule_data
        })
    except Exception as e:
        print(f"Error generating schedule: {e}")
        schedule_data = generate_fallback_schedule(days, domain_averages)
        save_schedule(user["id"], json.dumps(schedule_data),
                      days, datetime.utcnow().isoformat())
        return jsonify({
            "ok": True,
            "schedule": schedule_data
        })


def generate_fallback_schedule(days, domain_averages):
    """Generate a basic schedule when LLM fails"""
    games_by_domain = {
        "Attention": [
            {"id": "typing", "name": "Typing Speed"},
            {"id": "tapping", "name": "Finger Tapping"}
        ],
        "Visualization": [
            {"id": "visual_puzzle", "name": "Visual Puzzle"}
        ],
        "Executive Function": [
            {"id": "stroop", "name": "Stroop Practice"}
        ],
        "Memory": [
            {"id": "recall", "name": "Word Recall"}
        ],
        "Orientation": [
            {"id": "orientation", "name": "Orientation"}
        ]
    }

    # Sort domains by score (lower scores = focus areas)
    sorted_domains = sorted(domain_averages.items(), key=lambda x: x[1])
    focus_domains = [d[0] for d in sorted_domains[:3]]

    all_games = [
        {"id": "typing", "name": "Typing Speed"},
        {"id": "visual_puzzle", "name": "Visual Puzzle"},
        {"id": "stroop", "name": "Stroop Practice"},
        {"id": "recall", "name": "Word Recall"},
        {"id": "tapping", "name": "Finger Tapping"},
        {"id": "orientation", "name": "Orientation"}
    ]

    schedule_days = []
    for day_num in range(1, days + 1):
        focus_domain = focus_domains[day_num % len(
            focus_domains)] if focus_domains else "Attention"

        # Pick 3-5 random games for this day
        import random
        num_games = random.randint(3, min(5, len(all_games)))
        selected_games = random.sample(all_games, num_games)

        schedule_days.append({
            "focus": f"Improve {focus_domain}",
            "description": f"Complete these games to enhance your {focus_domain} skills",
            "games": selected_games
        })

    return {"days": schedule_days}


@app.post("/api/schedule-chat")
@login_required
def schedule_chat_api():
    import random
    user = current_user()
    payload = request.get_json(force=True)
    message = payload.get("message", "").lower()
    current_schedule = payload.get("currentSchedule", {})

    response_text = ""
    updated_schedule = None

    # Game mapping
    game_map = {
        "typing": {"id": "typing", "name": "Typing Speed"},
        "visual": {"id": "visual_puzzle", "name": "Visual Puzzle"},
        "stroop": {"id": "stroop", "name": "Stroop Practice"},
        "recall": {"id": "recall", "name": "Word Recall"},
        "memory": {"id": "recall", "name": "Word Recall"},
        "tapping": {"id": "tapping", "name": "Finger Tapping"},
        "orientation": {"id": "orientation", "name": "Orientation"}
    }

    all_games = [
        {"id": "typing", "name": "Typing Speed"},
        {"id": "visual_puzzle", "name": "Visual Puzzle"},
        {"id": "stroop", "name": "Stroop Practice"},
        {"id": "recall", "name": "Word Recall"},
        {"id": "tapping", "name": "Finger Tapping"},
        {"id": "orientation", "name": "Orientation"}
    ]

    # Try LLM first
    try:
        schedule_info = json.dumps(current_schedule, indent=2)

        prompt = f"""You are a helpful cognitive training coach. The user is asking about their personalized training schedule.

Current Schedule:
{schedule_info}

User's Message: {message}

Respond helpfully and conversationally to their request. Acknowledge their specific needs.
Keep response concise, warm and encouraging (2-3 sentences max).
Do NOT include JSON in your response."""

        response = ollama.generate(
            model="mistral",
            prompt=prompt,
            stream=False
        )

        response_text = response['response'].strip()

        # Now generate modified schedule based on user message
        if current_schedule and "days" in current_schedule:
            # Detect what user wants
            if "less" in message or "reduce" in message or "fewer" in message or "2" in message or "3" in message:
                num_games_per_day = random.randint(2, 3)
            elif "more" in message or "add" in message or "increase" in message or "harder" in message or "4" in message or "5" in message:
                num_games_per_day = random.randint(4, 5)
            else:
                num_games_per_day = random.randint(3, 4)

            # Check if user wants specific game(s)
            priority_games = []
            for keyword, game in game_map.items():
                if keyword in message:
                    priority_games.append(game)

            updated_schedule = {"days": []}
            for day in current_schedule["days"]:
                day_games = []

                # Add priority games first if any
                if priority_games:
                    day_games.extend(priority_games[:num_games_per_day])

                # Fill remaining slots with random games
                remaining_needed = num_games_per_day - len(day_games)
                if remaining_needed > 0:
                    available = [g for g in all_games if g not in day_games]
                    day_games.extend(random.sample(
                        available, min(remaining_needed, len(available))))

                updated_schedule["days"].append({
                    "focus": day.get("focus", "Training"),
                    "description": "Complete these games as part of your training" if "less" not in message else "Focused practice for deeper learning",
                    "games": day_games[:num_games_per_day]
                })

    except Exception as e:
        print(f"Ollama not available, using intelligent fallback: {e}")

        # Intelligent fallback with actual schedule modification
        if "less" in message or "reduce" in message or "fewer" in message or "2" in message or "two" in message or "three" in message:
            response_text = "Perfect! Reducing to 2-3 games per day will help you go deeper with each one. Quality over quantity—let's do this!"
            num_games_per_day = random.randint(2, 3)
        elif "more" in message or "add" in message or "increase" in message or "harder" in message:
            response_text = "Love the enthusiasm! I'm bumping this up to 4-5 games daily. You're going to see real improvements!"
            num_games_per_day = random.randint(4, 5)
        else:
            response_text = "Got it! Let me adjust your schedule based on your request."
            num_games_per_day = random.randint(3, 4)

        # Check for specific game requests
        priority_games = []
        for keyword, game in game_map.items():
            if keyword in message:
                priority_games.append(game)
                game_name = game["name"]
                if "typing" in keyword:
                    response_text = f"Adding more Typing Speed practice—great for boosting your attention and accuracy!"
                elif "recall" in keyword or "memory" in keyword:
                    response_text = f"Focusing on memory skills! Recall exercises are excellent for cognitive strength."
                elif "stroop" in keyword:
                    response_text = f"Building executive function with Stroop! This will sharpen your mental control."
                elif "visual" in keyword:
                    response_text = f"Enhancing visualization skills! Visual puzzles are fantastic for spatial reasoning."
                elif "tapping" in keyword:
                    response_text = f"Adding Finger Tapping to strengthen attention and motor control!"
                elif "orientation" in keyword:
                    response_text = f"Orientation work will help you stay sharp and aware!"

        # Now create modified schedule
        if current_schedule and "days" in current_schedule:
            updated_schedule = {"days": []}
            for day in current_schedule["days"]:
                day_games = []

                # Add priority games first if any
                if priority_games:
                    day_games.extend(priority_games[:num_games_per_day])

                # Fill remaining slots with random games
                remaining_needed = num_games_per_day - len(day_games)
                if remaining_needed > 0:
                    available = [g for g in all_games if g not in day_games]
                    day_games.extend(random.sample(
                        available, min(remaining_needed, len(available))))

                updated_schedule["days"].append({
                    "focus": day.get("focus", "Training"),
                    "description": "Complete these games as part of your training",
                    "games": day_games[:num_games_per_day]
                })

    # Save updated schedule to database if it was modified
    if updated_schedule:
        num_days = len(updated_schedule.get("days", []))
        save_schedule(user["id"], json.dumps(updated_schedule),
                      num_days, datetime.utcnow().isoformat())

    return jsonify({
        "ok": True,
        "response": response_text,
        "updatedSchedule": updated_schedule
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)

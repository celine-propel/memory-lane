from flask import Flask, render_template, request, redirect, url_for, jsonify, session
from functools import wraps
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
import ollama
import json
import re
from datetime import date

from db import (
    init_db, create_user, get_user_by_email, get_user_by_id,
    add_score, get_scores, save_schedule, get_latest_schedule,
    update_user_profile,
    add_orientation_question, get_orientation_questions,
    deactivate_orientation_question, get_orientation_questions_by_ids
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

def extract_json_object(text: str):
    """
    Extract the first top-level JSON object from model output.
    Handles ```json ...``` wrappers and extra text.
    """
    if not text:
        return None

    t = text.strip()

    # Remove fenced code blocks
    if t.startswith("```"):
        parts = t.split("```")
        if len(parts) >= 2:
            t = parts[1]
            t = t.replace("json", "", 1).strip()

    # Find first {...} block
    start = t.find("{")
    end = t.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None

    candidate = t[start:end+1]
    try:
        return json.loads(candidate)
    except:
        return None


def add_dates_to_schedule(schedule_data, days):
    """
    Force schedule to start today and have sequential day.date fields.
    """
    from datetime import date, timedelta

    today = date.today()

    # Force start_date and num_days
    schedule_data["start_date"] = today.isoformat()
    schedule_data["num_days"] = int(days)

    # Ensure days list
    if "days" not in schedule_data or not isinstance(schedule_data["days"], list):
        schedule_data["days"] = []

    # Trim/extend to exactly N days
    schedule_data["days"] = schedule_data["days"][:days]
    while len(schedule_data["days"]) < days:
        schedule_data["days"].append({
            "focus": "Training",
            "description": "Quick cognitive warm-up.",
            "games": []
        })

    # FORCE date for each day (override whatever the model returned)
    for i in range(days):
        d = schedule_data["days"][i]
        if not isinstance(d, dict):
            d = {"focus": "Training", "description": "", "games": []}
            schedule_data["days"][i] = d

        d["date"] = (today + timedelta(days=i)).isoformat()

        # Ensure games exists
        if "games" not in d or not isinstance(d["games"], list):
            d["games"] = []

    return schedule_data

def mark_schedule_game_completed(user_id: int, game_id: str):
    """Mark today's instance of game_id as completed in the latest schedule."""
    latest = get_latest_schedule(user_id)
    if not latest:
        return

    try:
        schedule_data = json.loads(latest["schedule_data"])
    except:
        return

    today = date.today().isoformat()

    changed = False
    for day in schedule_data.get("days", []):
        if day.get("date") != today:
            continue

        for g in day.get("games", []):
            if g.get("id") == game_id:
                if not g.get("completed"):
                    g["completed"] = True
                    g["completed_at"] = datetime.utcnow().isoformat()
                    changed = True

    if changed:
        # Save as newest schedule snapshot (your app reads "latest" anyway)
        save_schedule(
            user_id,
            json.dumps(schedule_data),
            int(schedule_data.get("num_days", len(schedule_data.get("days", [])) or 7)),
            datetime.utcnow().isoformat()
        )


@app.route("/")
def home():
    return render_template("home.html", user=current_user(), subtitle="Quick signals, tracked over time")


@app.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        # Existing core fields
        name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        
        # New demographic fields
        age = request.form.get("age")
        gender = request.form.get("gender")
        gender_other = request.form.get("gender_other")
        ethnicity = request.form.get("ethnicity")
        city = request.form.get("city")
        state = request.form.get("state")
        country = request.form.get("country")

        if not name or not email or not password:
            return render_template("register.html", error="Please fill out all fields.")
        
        if get_user_by_email(email):
            return render_template("register.html", error="Email already registered.")
        
        pw_hash = generate_password_hash(password)
        
        # Call the updated create_user function with all new parameters
        create_user(
            name, 
            email, 
            pw_hash, 
            datetime.utcnow().isoformat(),
            age=age,
            gender=gender,
            gender_other=gender_other,
            ethnicity=ethnicity,
            city=city,
            state=state,
            country=country
        )
        
        user = get_user_by_email(email)
        session["user_id"] = user["id"]

        # Optional: save up to 3 orientation questions from registration
        for i in (1, 2, 3):
            p = request.form.get(f"oq_prompt_{i}", "").strip()
            a = request.form.get(f"oq_answer_{i}", "").strip()
            if p and a:
                add_orientation_question(user["id"], p, a, datetime.utcnow().isoformat())

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

@app.route("/profile", methods=["GET", "POST"])
@login_required
def profile():
    user = current_user()
    if not user:
        return redirect(url_for("login"))

    if request.method == "POST":
        # Mandatory: name
        name = request.form.get("name", "").strip() or user["name"]

        # Optional fields
        age = request.form.get("age") or None
        gender = request.form.get("gender") or None
        gender_other = request.form.get("gender_other") or None
        ethnicity = request.form.get("ethnicity") or None
        city = request.form.get("city") or None
        state = request.form.get("state") or None
        country = request.form.get("country") or None

        update_user_profile(
            user["id"],
            name=name,
            age=age,
            gender=gender,
            gender_other=gender_other,
            ethnicity=ethnicity,
            city=city,
            state=state,
            country=country
        )

        user = current_user()  # refresh
        questions = get_orientation_questions(user["id"], active_only=True)
        return render_template("profile.html", user=user, questions=questions, msg="Profile saved.", subtitle="Profile")

    questions = get_orientation_questions(user["id"], active_only=True)
    return render_template("profile.html", user=user, questions=questions, subtitle="Profile")


@app.post("/profile/questions/add")
@login_required
def profile_add_question():
    user = current_user()
    prompt = request.form.get("prompt", "").strip()
    answer = request.form.get("answer", "").strip()

    # Optional: only save if both exist
    if prompt and answer:
        add_orientation_question(user["id"], prompt, answer, datetime.utcnow().isoformat())

    return redirect(url_for("profile"))


@app.post("/profile/questions/<int:q_id>/delete")
@login_required
def profile_delete_question(q_id):
    user = current_user()
    deactivate_orientation_question(user["id"], q_id)
    return redirect(url_for("profile"))

@app.get("/api/orientation/prompts")
@login_required
def api_orientation_prompts():
    user = current_user()

    device = [
        {"key": "month", "label": "What month is it?", "type": "device"},
        {"key": "date", "label": "What is the date today?", "type": "device"},
        {"key": "year", "label": "What year is it?", "type": "device"},
        {"key": "day", "label": "What day of the week is it?", "type": "device"},
    ]

    custom_rows = get_orientation_questions(user["id"], active_only=True)
    custom_rows = list(custom_rows)

    import random
    random.shuffle(custom_rows)

    # pick up to 3, but allow fewer (optional feature)
    picked = custom_rows[:3]
    custom = [{"key": f"custom_{q['id']}", "label": q["prompt"], "type": "custom"} for q in picked]

    questions = device + custom
    random.shuffle(questions)

    return jsonify({"questions": questions})


@app.post("/api/orientation/grade_custom")
@login_required
def api_orientation_grade_custom():
    user = current_user()
    payload = request.get_json(force=True)

    answers = payload.get("answers", [])  # [{key, answer}]
    id_to_answer = {}

    for a in answers:
        k = a.get("key", "")
        if k.startswith("custom_"):
            try:
                qid = int(k.split("_")[1])
            except:
                continue
            id_to_answer[qid] = (a.get("answer") or "").strip().lower()

    if not id_to_answer:
        return jsonify({"customScore": 0, "customTotal": 0})

    rows = get_orientation_questions_by_ids(user["id"], list(id_to_answer.keys()))
    score = 0
    total = len(rows)

    for r in rows:
        if id_to_answer.get(r["id"], "") == (r["answer_norm"] or ""):
            score += 1

    return jsonify({"customScore": score, "customTotal": total})

@app.route("/tests")
@login_required
def tests():
    # Only one Stroop test here
    games = [
        {"id": "stroop",
            "name": "Stroop Color Test", "domain": "Executive Function", "minutes": 1},
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


from datetime import date

@app.route("/practice")
@login_required
def practice():
    user = current_user()

    games = [
        {"id": "stroop", "name": "Stroop Practice", "domain": "Executive Function", "minutes": 2},
        {"id": "typing", "name": "Typing Speed", "domain": "Attention", "minutes": 2},
        {"id": "visual_puzzle", "name": "Visual Puzzle", "domain": "Visualization", "minutes": 2},
        {"id": "trails", "name": "Trails", "domain": "Pattern Identification", "minutes": 2}
    ]

    todays_tasks = []
    latest = get_latest_schedule(user["id"])
    if latest:
        try:
            sched = json.loads(latest["schedule_data"])
            today = date.today().isoformat()
            for d in sched.get("days", []):
                if d.get("date") == today:
                    todays_tasks = d.get("games", []) or []
                    break
        except:
            todays_tasks = []

    return render_template(
        "practice.html",
        games=games,
        todays_tasks=todays_tasks,
        user=user,
        subtitle="Personalized training"
    )



@app.route("/dashboard")
@login_required
def dashboard():
    user = current_user()
    if not user:
        session.pop("user_id", None)
        return redirect(url_for("login"))
    
    # Fetch recent scores
    scores = get_scores(user["id"], limit=30)
    latest_by_domain = {}
    
    # Group the absolute latest score for each unique domain
    for s in scores:
        if s["domain"] not in latest_by_domain:
            latest_by_domain[s["domain"]] = s

    # Formula: Average of all unique category scores
    domain_values = [s["value"] for s in latest_by_domain.values()]
    overall_score = sum(domain_values) / len(domain_values) if domain_values else 0

    return render_template(
        "dashboard.html",
        user=user,
        scores=scores,
        latest_by_domain=latest_by_domain,
        overall_score=overall_score, # Pass the calculated average
        subtitle="Your results"
    )

@app.post("/api/score")
@login_required
def api_score():
    import json
    user = current_user()
    payload = request.get_json(force=True)

    details = json.dumps(payload.get("details", {})) if payload.get("details") else None
    add_score(
        user["id"],
        payload.get("game"),
        payload.get("domain"),
        payload.get("value"),
        datetime.utcnow().isoformat(),
        details
    )

    # NEW: mark today's scheduled instance complete
    try:
        mark_schedule_game_completed(user["id"], payload.get("game"))
    except Exception as e:
        print("Could not mark completed:", e)

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
    # Define fallback words once at the top to avoid repeating the list
    import random
    fallback_sets = [
        ["bicycle", "candle", "planet", "quilt", "tower"],
        ["apron", "glider", "jungle", "magnet", "sculpt"],
        ["fossil", "melody", "pastry", "shield", "tunnel"],
        ["banner", "cavern", "falcon", "locket", "vessel"],
        ["bellow", "canyon", "hammer", "napkin", "valley"],
        ["anchor", "desert", "marble", "safari", "temple"],
        ["cactus", "dragon", "island", "museum", "rocket"]
    ]

    try:
        # Use Ollama to generate words via local LLM
        response = ollama.generate(
            model="mistral",
            prompt="Generate exactly 5 random common English words separated by commas. Just the words, nothing else. Example format: cat, book, tree, water, light",
            stream=False
        )

        words_str = response['response'].strip()
        # FIX: Changed [:4] to [:5] to actually get five words
        words = [w.strip().lower() for w in words_str.split(',')][:5]

        # Fallback if the AI returned fewer than 5 words
        if len(words) < 5:
            words = random.choice(fallback_sets)

        return jsonify({
            "words": words[:5] # Extra safety slice to ensure exactly 5
        })

    except Exception as e:
        print(f"LLM Error: {e}")
        # Fallback words if LLM is unavailable entirely
        selected_set = random.choice(fallback_sets)
        return jsonify({
            "words": selected_set[:5] # Ensure only 5 words from your expanded list are sent
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
    days = int(payload.get("days", 7))

    # You CAN keep using scores for now (it’s fine)
    scores = get_scores(user["id"], limit=100)

    # Domain averages (optional, but you already have it)
    domain_scores = {}
    for score in scores:
        domain = score["domain"]
        domain_scores.setdefault(domain, []).append(score["value"])
    domain_averages = {d: (sum(v)/len(v)) for d, v in domain_scores.items()} if domain_scores else {}

    domains_info = "\n".join([f"- {d}: {avg:.2f}/100" for d, avg in domain_averages.items()]) if domain_averages else "- No prior scores yet"

    prompt = f"""
You are a cognitive training coach. Create a {days}-day schedule starting today.

User signals (not a diagnosis):
{domains_info}

Available game ids (use ONLY these):
- typing
- visual_puzzle
- stroop
- recall
- tapping
- orientation
- trails
- fluency

Rules:
- Output ONLY valid JSON. No extra text.
- Exactly {days} days.
- Each day: 2 to 4 games.
- Include minutes (int) and a short reason for each game.
- Add a date for each day starting today.

Return EXACT schema:
{{
  "start_date": "YYYY-MM-DD",
  "num_days": {days},
  "days": [
    {{
      "date": "YYYY-MM-DD",
      "focus": "short title",
      "description": "1 sentence",
      "games": [
        {{"id":"stroop","name":"Stroop Practice","minutes":2,"reason":"..."}}
      ]
    }}
  ]
}}
"""

    try:
        response = ollama.generate(model="mistral", prompt=prompt, stream=False)
        schedule_text = response.get("response", "").strip()
        schedule_data = extract_json_object(schedule_text)

        if not schedule_data:
            schedule_data = generate_fallback_schedule(days, domain_averages)

        schedule_data = add_dates_to_schedule(schedule_data, days)

        # Save schedule to DB
        save_schedule(user["id"], json.dumps(schedule_data), days, datetime.utcnow().isoformat())

        return jsonify({"ok": True, "schedule": schedule_data})

    except Exception as e:
        print(f"Error generating schedule: {e}")
        schedule_data = generate_fallback_schedule(days, domain_averages)
        schedule_data = add_dates_to_schedule(schedule_data, days)
        save_schedule(user["id"], json.dumps(schedule_data), days, datetime.utcnow().isoformat())
        return jsonify({"ok": True, "schedule": schedule_data})



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
    user = current_user()
    payload = request.get_json(force=True)

    message = (payload.get("message") or "").strip()
    current_schedule = payload.get("currentSchedule") or {}

    if not message:
        return jsonify({"ok": True, "response": "Tell me what you want to change.", "updatedSchedule": None})

    # If schedule missing/empty, make a quick one so chat can still work
    if not current_schedule or "days" not in current_schedule:
        current_schedule = add_dates_to_schedule({"days": []}, 7)

    prompt = f"""
You are an AI schedule coach. The user wants changes to their schedule.

Current schedule JSON:
{json.dumps(current_schedule, indent=2)}

User message:
"{message}"

Instructions:
- Understand the request before acting.
- If user asks a question, answer it. If they ask for a change, update the schedule.
- If they say "today", apply the change to the day whose date equals today's date (already in the JSON).
- If they say "tomorrow", apply to the next date in the JSON.
- If they say "less / shorter", reduce to 2 games that day.
- If they say "more / harder", increase to 4 games that day.
- If they want more of a domain:
  - memory -> recall
  - executive/attention -> stroop or trails
  - visuospatial -> visual_puzzle
  - language -> fluency
- Keep ids valid: typing, visual_puzzle, stroop, recall, tapping, orientation, trails, fluency
- Output ONLY valid JSON (no extra text).

Return EXACT JSON:
{{
  "response": "1-4 sentences that clearly explains what you changed",
  "updatedSchedule": null OR {{
    "start_date": "...",
    "num_days": ...,
    "days": [...]
  }}
}}
"""

    try:
        response = ollama.generate(model="mistral", prompt=prompt, stream=False)
        out_text = response.get("response", "").strip()
        out = extract_json_object(out_text)

        if not out:
            return jsonify({
                "ok": True,
                "response": "I can help adjust it — try being specific like: 'Swap today’s Stroop for Fluency' or 'Make tomorrow shorter'.",
                "updatedSchedule": None
            })

        response_text = out.get("response", "Done.")
        updated = out.get("updatedSchedule", None)

        # If model returned a schedule, validate/patch essentials and save
        if updated and isinstance(updated, dict) and "days" in updated:
            days_count = len(updated.get("days", [])) or current_schedule.get("num_days", 7)
            updated = add_dates_to_schedule(updated, int(days_count))

            save_schedule(user["id"], json.dumps(updated), int(updated.get("num_days", days_count)), datetime.utcnow().isoformat())

            return jsonify({"ok": True, "response": response_text, "updatedSchedule": updated})

        # No schedule update requested
        return jsonify({"ok": True, "response": response_text, "updatedSchedule": None})

    except Exception as e:
        print(f"Chat error: {e}")
        return jsonify({
            "ok": True,
            "response": "Something went wrong on my end. Try again with a simpler request (e.g. 'make today shorter' or 'more memory tomorrow').",
            "updatedSchedule": None
        })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)

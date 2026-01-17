from flask import Flask, render_template, request, redirect, url_for, jsonify, session
from functools import wraps
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
import ollama

from db import (
    init_db, create_user, get_user_by_email, get_user_by_id,
    add_score, get_scores
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
            return render_template("register.html", error="That email is already registered.")

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
    games = [
        {"id": "stroop",
            "name": "Color Interference (Stroop)", "domain": "Executive Function", "minutes": 2},
        {"id": "typing-velocity", "name": "Focus Probe: Velocity",
            "domain": "Psychomotor", "minutes": 1},  # Added
        {"id": "tapping", "name": "Finger Tapping",
            "domain": "Motor Timing", "minutes": 1},
        {"id": "fluency", "name": "Verbal Fluency",
            "domain": "Language", "minutes": 1},
    ]
    return render_template("tests.html", games=games, user=current_user(), subtitle="Assessment tests")


@app.route("/tests/typing")
@login_required
def typing_test():
    return render_template("typing_test.html", user=current_user(), subtitle="Typing Assessment")


@app.route("/practice")
@login_required
def practice():
    plan = [
        {"name": "Speed Warm-up",
            "desc": "Short reaction drills to reduce hesitation.", "days": "Mon/Wed/Fri"},
        {"name": "Inhibition Practice",
            "desc": "Stroop-like practice with easier settings.", "days": "Tue/Thu"},
        {"name": "Focus Reset",
            "desc": "1-minute attention reset before tests.", "days": "Daily"},
    ]
    return render_template("practice.html", plan=plan, user=current_user(), subtitle="Personalized training")


@app.route("/dashboard")
@login_required
def dashboard():
    user = current_user()
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
    user = current_user()
    payload = request.get_json(force=True)
    game = payload.get("game", "unknown")
    domain = payload.get("domain", "unknown")
    value = payload.get("value", 0.0)
    created_at = datetime.utcnow().isoformat()

    add_score(user["id"], game, domain, value, created_at)
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


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)

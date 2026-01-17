from flask import Flask, render_template, request, redirect, url_for, jsonify
from datetime import datetime
from db import init_db, get_demo_user_id, add_score, get_scores

app = Flask(__name__)

init_db()

@app.route("/")
def home():
    return render_template("home.html")

@app.route("/tests")
def tests():
    # list of "assessment games"
    games = [
        {"id": "stroop", "name": "Color Interference (Stroop)", "domain": "Executive Function", "minutes": 2},
        {"id": "tapping", "name": "Finger Tapping", "domain": "Motor Timing", "minutes": 1},
        {"id": "fluency", "name": "Verbal Fluency", "domain": "Language", "minutes": 1},
    ]
    return render_template("tests.html", games=games)

@app.route("/practice")
def practice():
    # personalized training plan (demo version: rule-based)
    plan = [
        {"name": "Speed Warm-up", "desc": "Short reaction drills to reduce hesitation.", "days": "Mon/Wed/Fri"},
        {"name": "Inhibition Practice", "desc": "Stroop-like practice with easier settings.", "days": "Tue/Thu"},
        {"name": "Focus Reset", "desc": "1-minute calm + attention reset before tests.", "days": "Daily"},
    ]
    return render_template("practice.html", plan=plan)

@app.route("/dashboard")
def dashboard():
    user_id = get_demo_user_id()
    scores = get_scores(user_id, limit=30)
    # simple aggregates for demo
    latest_by_domain = {}
    for s in scores:
        if s["domain"] not in latest_by_domain:
            latest_by_domain[s["domain"]] = s
    return render_template("dashboard.html", scores=scores, latest_by_domain=latest_by_domain)

# Demo endpoint: "save a score" (later this becomes your ML output)
@app.post("/api/score")
def api_score():
    user_id = get_demo_user_id()
    payload = request.get_json(force=True)
    game = payload.get("game", "unknown")
    domain = payload.get("domain", "unknown")
    value = payload.get("value", 0.0)
    created_at = datetime.utcnow().isoformat()

    add_score(user_id, game, domain, value, created_at)
    return jsonify({"ok": True})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)

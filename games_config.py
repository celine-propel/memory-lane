# games_config.py
GAMES = [
    {
        "id": "stroop",
        "name": "Color Interference",
        "domain": "Executive Function",
        "minutes": 2,
        "route": "/game/stroop",
        "mode": "test"   # or "practice"
    },
    {
        "id": "tapping",
        "name": "Finger Tapping",
        "domain": "Motor Timing",
        "minutes": 1,
        "route": "/game/tapping",
        "mode": "test"
    },
    {
        "id": "focus",
        "name": "Focus Warm-up",
        "domain": "Attention",
        "minutes": 1,
        "route": "/game/focus",
        "mode": "practice"
    }
]

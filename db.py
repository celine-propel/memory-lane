import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "app.db"
SCHEMA_PATH = Path(__file__).parent / "schema.sql"

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_conn()
    conn.executescript(SCHEMA_PATH.read_text())
    # create a default user for demo
    cur = conn.execute("SELECT id FROM user LIMIT 1")
    if cur.fetchone() is None:
        conn.execute("INSERT INTO user (name) VALUES (?)", ("Demo User",))
    conn.commit()
    conn.close()

def get_demo_user_id():
    conn = get_conn()
    row = conn.execute("SELECT id FROM user LIMIT 1").fetchone()
    conn.close()
    return row["id"]

def add_score(user_id, game, domain, value, created_at):
    conn = get_conn()
    conn.execute(
        "INSERT INTO score (user_id, game, domain, value, created_at) VALUES (?,?,?,?,?)",
        (user_id, game, domain, float(value), created_at)
    )
    conn.commit()
    conn.close()

def get_scores(user_id, limit=20):
    conn = get_conn()
    rows = conn.execute(
        "SELECT game, domain, value, created_at FROM score WHERE user_id=? ORDER BY id DESC LIMIT ?",
        (user_id, limit)
    ).fetchall()
    conn.close()
    return rows

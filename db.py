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
    conn.commit()

    # Add details column if it doesn't exist
    try:
        conn.execute("ALTER TABLE score ADD COLUMN details TEXT")
        conn.commit()
    except sqlite3.OperationalError:
        # Column already exists
        pass

    conn.close()


def create_user(name, email, password_hash, created_at):
    conn = get_conn()
    conn.execute(
        "INSERT INTO user (name, email, password_hash, created_at) VALUES (?,?,?,?)",
        (name, email.lower().strip(), password_hash, created_at)
    )
    conn.commit()
    conn.close()


def get_user_by_email(email):
    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM user WHERE email=?",
        (email.lower().strip(),)
    ).fetchone()
    conn.close()
    return row


def get_user_by_id(user_id):
    conn = get_conn()
    row = conn.execute("SELECT * FROM user WHERE id=?", (user_id,)).fetchone()
    conn.close()
    return row


def add_score(user_id, game, domain, value, created_at, details=None):
    conn = get_conn()
    conn.execute(
        "INSERT INTO score (user_id, game, domain, value, created_at, details) VALUES (?,?,?,?,?,?)",
        (user_id, game, domain, float(value), created_at, details)
    )
    conn.commit()
    conn.close()


def get_scores(user_id, limit=20):
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, game, domain, value, created_at, details FROM score WHERE user_id=? ORDER BY id DESC LIMIT ?",
        (user_id, limit)
    ).fetchall()
    conn.close()
    return rows

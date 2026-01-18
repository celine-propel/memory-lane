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


def create_user(name, email, password_hash, created_at, age=None, gender=None, gender_other=None, ethnicity=None, city=None, state=None, country=None):
    conn = get_conn()
    conn.execute(
        """INSERT INTO user (
            name, email, password_hash, created_at, 
            age, gender, gender_other, ethnicity, 
            city, state, country
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        (
            name, email.lower().strip(), password_hash, created_at, 
            age, gender, gender_other, ethnicity, 
            city, state, country
        )
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


def save_schedule(user_id, schedule_data, num_days, created_at):
    """Save or update user's schedule"""
    conn = get_conn()
    conn.execute(
        "INSERT INTO schedule (user_id, schedule_data, num_days, created_at) VALUES (?,?,?,?)",
        (user_id, schedule_data, num_days, created_at)
    )
    conn.commit()
    conn.close()


def get_latest_schedule(user_id):
    """Get the latest schedule for a user"""
    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM schedule WHERE user_id=? ORDER BY created_at DESC LIMIT 1",
        (user_id,)
    ).fetchone()
    conn.close()
    return row

def norm_answer(s: str) -> str:
    return (s or "").strip().lower()

def update_user_profile(user_id, name, age=None, gender=None, gender_other=None,
                        ethnicity=None, city=None, state=None, country=None):
    conn = get_conn()
    conn.execute(
        """UPDATE user
           SET name=?,
               age=?,
               gender=?,
               gender_other=?,
               ethnicity=?,
               city=?,
               state=?,
               country=?
           WHERE id=?""",
        (name, age, gender, gender_other, ethnicity, city, state, country, user_id)
    )
    conn.commit()
    conn.close()


def add_orientation_question(user_id, prompt, answer, created_at):
    prompt = (prompt or "").strip()
    answer_norm = norm_answer(answer)
    if not prompt or not answer_norm:
        return

    conn = get_conn()
    conn.execute(
        """INSERT INTO orientation_question (user_id, prompt, answer_norm, active, created_at)
           VALUES (?,?,?,?,?)""",
        (user_id, prompt, answer_norm, 1, created_at)
    )
    conn.commit()
    conn.close()


def get_orientation_questions(user_id, active_only=True):
    conn = get_conn()
    if active_only:
        rows = conn.execute(
            "SELECT * FROM orientation_question WHERE user_id=? AND active=1 ORDER BY id DESC",
            (user_id,)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM orientation_question WHERE user_id=? ORDER BY id DESC",
            (user_id,)
        ).fetchall()
    conn.close()
    return rows


def deactivate_orientation_question(user_id, q_id):
    conn = get_conn()
    conn.execute(
        "UPDATE orientation_question SET active=0 WHERE id=? AND user_id=?",
        (q_id, user_id)
    )
    conn.commit()
    conn.close()


def get_orientation_questions_by_ids(user_id, ids):
    if not ids:
        return []
    placeholders = ",".join(["?"] * len(ids))
    conn = get_conn()
    rows = conn.execute(
        f"""SELECT * FROM orientation_question
            WHERE user_id=? AND active=1 AND id IN ({placeholders})""",
        (user_id, *ids)
    ).fetchall()
    conn.close()
    return rows

CREATE TABLE IF NOT EXISTS user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  age INTEGER,
  gender TEXT,
  gender_other TEXT,
  ethnicity TEXT,
  city TEXT,
  state TEXT,
  country TEXT
);

CREATE TABLE IF NOT EXISTS score (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  game TEXT NOT NULL,
  domain TEXT NOT NULL,
  value REAL NOT NULL,
  created_at TEXT NOT NULL,
  details TEXT,
  FOREIGN KEY(user_id) REFERENCES user(id)
);

CREATE TABLE IF NOT EXISTS schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  schedule_data TEXT NOT NULL,
  num_days INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES user(id)
);

CREATE TABLE IF NOT EXISTS orientation_question (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  answer_norm TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES user(id)
);

CREATE TABLE IF NOT EXISTS bandit_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  game TEXT NOT NULL,
  context TEXT NOT NULL,
  action TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  value REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES user(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bandit_state_unique
  ON bandit_state (user_id, game, context, action);

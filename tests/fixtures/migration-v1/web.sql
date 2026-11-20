CREATE TABLE app_sessions (
 token_hash TEXT PRIMARY KEY,
 staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
 csrf_token TEXT NOT NULL,
 expires_at TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX ix_app_sessions_staff ON app_sessions(staff_id);
CREATE TABLE app_login_attempts (
 attempt_key TEXT PRIMARY KEY,
 failures INTEGER NOT NULL DEFAULT 0,
 window_start INTEGER NOT NULL
);
CREATE TABLE app_revision (
 id INTEGER PRIMARY KEY CHECK(id=1),
 revision INTEGER NOT NULL CHECK(revision>=0)
);
CREATE TABLE app_assertion (ok INTEGER NOT NULL CHECK(ok=1));

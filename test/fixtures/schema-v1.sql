PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 name TEXT NOT NULL, password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'reader' CHECK(role IN ('reader','staff','manager')),
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS activities (
 id TEXT PRIMARY KEY, source_id TEXT UNIQUE, title TEXT NOT NULL, category TEXT NOT NULL,
 description TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL,
 location TEXT NOT NULL, capacity INTEGER NOT NULL CHECK(capacity > 0),
 fee_cents INTEGER NOT NULL DEFAULT 0 CHECK(fee_cents >= 0),
 publish_status TEXT NOT NULL CHECK(publish_status IN ('draft','pending','published','offline')),
 is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0,1)),
 created_by TEXT REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS registrations (
 id TEXT PRIMARY KEY, source_id TEXT UNIQUE, user_id TEXT NOT NULL REFERENCES users(id),
 activity_id TEXT NOT NULL REFERENCES activities(id), attendee_name TEXT NOT NULL,
 phone TEXT NOT NULL, headcount INTEGER NOT NULL DEFAULT 1 CHECK(headcount = 1),
 ticket_code TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL CHECK(status IN ('confirmed','cancelled','checked_in')),
 privacy_consent INTEGER NOT NULL CHECK(privacy_consent = 1), privacy_consent_at TEXT NOT NULL,
 created_at TEXT NOT NULL, cancelled_at TEXT, checked_in_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_registration
 ON registrations(user_id, activity_id) WHERE status IN ('confirmed','checked_in');
CREATE INDEX IF NOT EXISTS registrations_activity ON registrations(activity_id, status);
CREATE INDEX IF NOT EXISTS activities_start ON activities(publish_status, start_time);
CREATE TABLE IF NOT EXISTS feedbacks (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
 activity_id TEXT NOT NULL REFERENCES activities(id),
 registration_id TEXT NOT NULL UNIQUE REFERENCES registrations(id),
 rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), content TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','replied','closed')),
 reply TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS books (
 id TEXT PRIMARY KEY, source_id TEXT UNIQUE, title TEXT NOT NULL, author TEXT NOT NULL,
 category TEXT NOT NULL, summary TEXT NOT NULL, isbn TEXT, price_cents INTEGER CHECK(price_cents >= 0),
 recommendation_rank INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS operation_logs (
 id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES users(id),
 action TEXT NOT NULL, target_id TEXT NOT NULL, created_at TEXT NOT NULL
);
PRAGMA user_version = 1;

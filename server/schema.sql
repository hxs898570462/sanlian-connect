CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL,
 name TEXT NOT NULL, password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','stuff')),
 is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
 created_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users(lower(email));
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS activities (
 id TEXT PRIMARY KEY, source_id TEXT UNIQUE, title TEXT NOT NULL, category TEXT NOT NULL,
 description TEXT NOT NULL, start_time TIMESTAMPTZ NOT NULL, end_time TIMESTAMPTZ NOT NULL,
 location TEXT NOT NULL, capacity INTEGER NOT NULL CHECK(capacity > 0),
 fee_cents INTEGER NOT NULL DEFAULT 0 CHECK(fee_cents >= 0),
 publish_status TEXT NOT NULL CHECK(publish_status IN ('draft','pending','published','offline')),
 is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0,1)),
 created_by TEXT REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL,
 CHECK(end_time > start_time)
);
CREATE TABLE IF NOT EXISTS registrations (
 id TEXT PRIMARY KEY, source_id TEXT UNIQUE, user_id TEXT NOT NULL REFERENCES users(id),
 activity_id TEXT NOT NULL REFERENCES activities(id), attendee_name TEXT NOT NULL,
 phone TEXT NOT NULL, headcount INTEGER NOT NULL DEFAULT 1 CHECK(headcount = 1),
 ticket_code TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL CHECK(status IN ('confirmed','cancelled','checked_in')),
 privacy_consent INTEGER NOT NULL CHECK(privacy_consent = 1), privacy_consent_at TIMESTAMPTZ NOT NULL,
 created_at TIMESTAMPTZ NOT NULL, cancelled_at TIMESTAMPTZ, checked_in_at TIMESTAMPTZ,
 UNIQUE(id,user_id,activity_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_registration
 ON registrations(user_id,activity_id) WHERE status IN ('confirmed','checked_in');
CREATE INDEX IF NOT EXISTS registrations_activity ON registrations(activity_id,status);
CREATE INDEX IF NOT EXISTS activities_start ON activities(publish_status,start_time);
CREATE TABLE IF NOT EXISTS feedbacks (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
 activity_id TEXT NOT NULL REFERENCES activities(id),
 registration_id TEXT NOT NULL UNIQUE REFERENCES registrations(id),
 rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), content TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','replied','closed')),
 reply TEXT, created_at TIMESTAMPTZ NOT NULL,
 FOREIGN KEY(registration_id,user_id,activity_id) REFERENCES registrations(id,user_id,activity_id)
);
CREATE TABLE IF NOT EXISTS suggestions (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id),
 content TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','replied','closed')),
 reply TEXT, created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS suggestions_user ON suggestions(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS books (
 id TEXT PRIMARY KEY, source_id TEXT UNIQUE, title TEXT NOT NULL, author TEXT NOT NULL,
 category TEXT NOT NULL, summary TEXT NOT NULL, isbn TEXT, price_cents INTEGER CHECK(price_cents >= 0),
 recommendation_rank INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS operation_logs (
 id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES users(id),
 action TEXT NOT NULL, target_id TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS schema_migrations (
 version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO schema_migrations(version) VALUES(1) ON CONFLICT DO NOTHING;

DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version=2) THEN
  ALTER TABLE users
   ADD COLUMN gender TEXT NOT NULL DEFAULT '' CHECK(gender IN ('','female','male','other')),
   ADD COLUMN region VARCHAR(60) NOT NULL DEFAULT '',
   ADD COLUMN signature VARCHAR(100) NOT NULL DEFAULT '';
  INSERT INTO schema_migrations(version) VALUES(2);
 END IF;
END $$;
-- v3：反馈与建议接入智能打分引擎（server/feedback-scoring.js），
-- score 为静态规则分，score_level 为静态优先级，score_hits 为命中词条（空格分隔）；
-- 等待加成不落库，由管理端查询时按当前时间动态计算。
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version=3) THEN
  ALTER TABLE feedbacks
   ADD COLUMN score INTEGER NOT NULL DEFAULT 0,
   ADD COLUMN score_level TEXT NOT NULL DEFAULT 'low' CHECK(score_level IN ('high','mid','low')),
   ADD COLUMN score_hits TEXT NOT NULL DEFAULT '';
  ALTER TABLE suggestions
   ADD COLUMN score INTEGER NOT NULL DEFAULT 0,
   ADD COLUMN score_level TEXT NOT NULL DEFAULT 'low' CHECK(score_level IN ('high','mid','low')),
   ADD COLUMN score_hits TEXT NOT NULL DEFAULT '';
  INSERT INTO schema_migrations(version) VALUES(3);
 END IF;
END $$;
-- v4：打分引擎叠加「优质评论」维度（长度深度、具体性、多面覆盖、情感适中、建设性、评分一致性），
-- score_quality 记录优质加成的可解释标签（空格分隔），与 score_hits 的命中词条共同解释总分。
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version=4) THEN
  ALTER TABLE feedbacks
   ADD COLUMN score_quality TEXT NOT NULL DEFAULT '';
  ALTER TABLE suggestions
   ADD COLUMN score_quality TEXT NOT NULL DEFAULT '';
  INSERT INTO schema_migrations(version) VALUES(4);
 END IF;
END $$;

DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version=5) THEN
  ALTER TABLE activities ADD COLUMN registration_until_end BOOLEAN NOT NULL DEFAULT FALSE;
  INSERT INTO schema_migrations(version) VALUES(5);
 END IF;
END $$;

DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version=6) THEN
  CREATE TABLE seats (
   code TEXT PRIMARY KEY CHECK(code ~ '^(A-(0[1-9]|1[0-2])|B-(0[1-9]|1[01]))$')
  );
  INSERT INTO seats(code)
   SELECT 'A-' || lpad(n::text,2,'0') FROM generate_series(1,12) AS n
   UNION ALL
   SELECT 'B-' || lpad(n::text,2,'0') FROM generate_series(1,11) AS n;
  CREATE TABLE seat_reservations (
   id TEXT PRIMARY KEY,
   seat_code TEXT NOT NULL REFERENCES seats(code),
   user_id TEXT NOT NULL REFERENCES users(id),
   starts_at TIMESTAMPTZ NOT NULL,
   ends_at TIMESTAMPTZ NOT NULL CHECK(ends_at > starts_at),
   created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
   cancelled_at TIMESTAMPTZ
  );
  CREATE UNIQUE INDEX active_seat_slot ON seat_reservations(starts_at,seat_code) WHERE cancelled_at IS NULL;
  CREATE UNIQUE INDEX active_reader_slot ON seat_reservations(user_id,starts_at) WHERE cancelled_at IS NULL;
  CREATE INDEX seat_reservation_roster ON seat_reservations(starts_at,seat_code);
  CREATE INDEX seat_reservation_history ON seat_reservations(user_id,starts_at DESC);
  INSERT INTO schema_migrations(version) VALUES(6);
 END IF;
END $$;

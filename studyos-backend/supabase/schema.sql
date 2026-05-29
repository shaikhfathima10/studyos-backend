-- ═══════════════════════════════════════════════════════════
-- StudyOS — Supabase Schema
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── USERS (extends Supabase auth.users) ────────────────────
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  goal          TEXT,                        -- "Score 90%+", "Pass with merit" etc.
  exam_date     DATE,
  daily_hours   NUMERIC(4,1) DEFAULT 4,
  study_style   TEXT DEFAULT 'pomodoro',     -- pomodoro | long_block | flexible
  best_time     TEXT DEFAULT 'morning',      -- morning | afternoon | evening | night
  xp            INTEGER DEFAULT 0,
  level         INTEGER DEFAULT 1,
  streak        INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_studied  DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SUBJECTS ────────────────────────────────────────────────
CREATE TABLE subjects (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  emoji         TEXT DEFAULT '📚',
  color         TEXT DEFAULT '#6C63FF',
  target_hours  NUMERIC(5,1) DEFAULT 20,
  studied_hours NUMERIC(5,1) DEFAULT 0,
  confidence    INTEGER DEFAULT 50 CHECK (confidence BETWEEN 0 AND 100),
  priority      TEXT DEFAULT 'medium'        -- critical | high | medium | low
                CHECK (priority IN ('critical','high','medium','low')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── TOPICS (sub-items of a subject) ─────────────────────────
CREATE TABLE topics (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id    UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  confidence    INTEGER DEFAULT 50 CHECK (confidence BETWEEN 0 AND 100),
  last_reviewed DATE,
  next_review   DATE,                        -- spaced repetition next date
  review_interval INTEGER DEFAULT 1,         -- SM-2 interval in days
  ease_factor   NUMERIC(4,2) DEFAULT 2.5,    -- SM-2 ease factor
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SCHEDULE BLOCKS ─────────────────────────────────────────
CREATE TABLE schedule_blocks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject_id    UUID REFERENCES subjects(id) ON DELETE SET NULL,
  topic_id      UUID REFERENCES topics(id) ON DELETE SET NULL,
  scheduled_date DATE NOT NULL,
  start_time    TIME NOT NULL,
  duration_min  INTEGER NOT NULL DEFAULT 50,
  block_type    TEXT DEFAULT 'study'         -- study | revision | break | exam
                CHECK (block_type IN ('study','revision','break','exam')),
  status        TEXT DEFAULT 'pending'       -- pending | active | done | skipped
                CHECK (status IN ('pending','active','done','skipped')),
  ai_generated  BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── STUDY SESSIONS (actual completed pomodoros) ─────────────
CREATE TABLE sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  block_id      UUID REFERENCES schedule_blocks(id) ON DELETE SET NULL,
  subject_id    UUID REFERENCES subjects(id) ON DELETE SET NULL,
  topic_id      UUID REFERENCES topics(id) ON DELETE SET NULL,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at      TIMESTAMPTZ,
  duration_min  INTEGER,                     -- actual duration
  planned_min   INTEGER DEFAULT 25,          -- planned (pomodoro length)
  session_type  TEXT DEFAULT 'focus'         -- focus | short_break | long_break
                CHECK (session_type IN ('focus','short_break','long_break')),
  confidence_before INTEGER,                 -- 0-100 user rating before
  confidence_after  INTEGER,                 -- 0-100 user rating after
  mood          TEXT,                        -- great | good | okay | tired
  notes         TEXT,
  xp_earned     INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── CONFIDENCE HISTORY ───────────────────────────────────────
CREATE TABLE confidence_history (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject_id    UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  topic_id      UUID REFERENCES topics(id) ON DELETE SET NULL,
  confidence    INTEGER NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  recorded_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── READINESS SNAPSHOTS ─────────────────────────────────────
CREATE TABLE readiness_snapshots (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  readiness     INTEGER NOT NULL CHECK (readiness BETWEEN 0 AND 100),
  breakdown     JSONB,                       -- per-subject readiness scores
  ai_analysis   TEXT,                        -- AI explanation text
  snapshot_date DATE DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── BADGES ──────────────────────────────────────────────────
CREATE TABLE badges (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key           TEXT UNIQUE NOT NULL,        -- "seven_day_streak", "century", etc.
  name          TEXT NOT NULL,
  description   TEXT,
  icon          TEXT,
  xp_reward     INTEGER DEFAULT 100
);

CREATE TABLE user_badges (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id      UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

-- ─── GROUP STUDY ROOMS ────────────────────────────────────────
CREATE TABLE study_rooms (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code          TEXT UNIQUE NOT NULL,        -- 6-char join code
  host_id       UUID NOT NULL REFERENCES profiles(id),
  subject_id    UUID REFERENCES subjects(id),
  name          TEXT NOT NULL,
  max_members   INTEGER DEFAULT 6,
  is_active     BOOLEAN DEFAULT TRUE,
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  ended_at      TIMESTAMPTZ
);

CREATE TABLE room_members (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id       UUID NOT NULL REFERENCES study_rooms(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at     TIMESTAMPTZ DEFAULT NOW(),
  left_at       TIMESTAMPTZ,
  UNIQUE(room_id, user_id)
);

-- ─── YOUTUBE VIDEO CACHE ──────────────────────────────────────
CREATE TABLE video_cache (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_name  TEXT NOT NULL,
  topic_name    TEXT,
  video_id      TEXT NOT NULL,
  title         TEXT NOT NULL,
  channel       TEXT,
  duration      TEXT,
  thumbnail_url TEXT,
  cached_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subject_name, video_id)
);

-- ─── SEED DEFAULT BADGES ─────────────────────────────────────
INSERT INTO badges (key, name, description, icon, xp_reward) VALUES
  ('first_session',   'First Step',      'Complete your first session',          '🌱', 50),
  ('seven_streak',    '7-Day Streak',    'Study 7 days in a row',               '🔥', 200),
  ('thirty_streak',   '30-Day Streak',   'Study 30 days in a row',              '💎', 1000),
  ('century',         'Century',         'Complete 100 pomodoro sessions',       '💯', 500),
  ('early_bird',      'Early Bird',      'Start a session before 7 AM',         '🌅', 100),
  ('night_owl',       'Night Owl',       'Study past midnight',                  '🦉', 100),
  ('perfect_week',    'Perfect Week',    'Hit daily target every day this week', '🏆', 300),
  ('speed_improver',  'Speed Improver',  'Raise a subject confidence by 20% in one week', '📈', 200),
  ('group_leader',    'Group Leader',    'Host your first group study room',    '👥', 150),
  ('top_scholar',     'Top Scholar',     'Reach 90% exam readiness',            '🎓', 500);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────
ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects             ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics               ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_blocks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE confidence_history   ENABLE ROW LEVEL SECURITY;
ALTER TABLE readiness_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges          ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "own_profile"     ON profiles             FOR ALL USING (auth.uid() = id);
CREATE POLICY "own_subjects"    ON subjects             FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_topics"      ON topics               FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_blocks"      ON schedule_blocks      FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_sessions"    ON sessions             FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_confidence"  ON confidence_history   FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_readiness"   ON readiness_snapshots  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_badges"      ON user_badges          FOR ALL USING (auth.uid() = user_id);

-- ─── INDEXES ─────────────────────────────────────────────────
CREATE INDEX idx_subjects_user        ON subjects(user_id);
CREATE INDEX idx_topics_subject       ON topics(subject_id);
CREATE INDEX idx_blocks_user_date     ON schedule_blocks(user_id, scheduled_date);
CREATE INDEX idx_sessions_user        ON sessions(user_id);
CREATE INDEX idx_sessions_started     ON sessions(started_at DESC);
CREATE INDEX idx_confidence_subject   ON confidence_history(subject_id, recorded_at DESC);
CREATE INDEX idx_readiness_user_date  ON readiness_snapshots(user_id, snapshot_date DESC);
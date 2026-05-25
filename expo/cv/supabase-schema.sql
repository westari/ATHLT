-- ATHLT CV Shot Tracking Schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New Query)
-- Safe to run multiple times — uses CREATE TABLE IF NOT EXISTS

-- ============================================================
-- shot_sessions — one row per tracking session
-- ============================================================

CREATE TABLE IF NOT EXISTS shot_sessions (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  drill_id            TEXT,                    -- null for open-run sessions
  drill_name          TEXT,
  day_index           INT,                     -- which plan day (null for open-run)
  drill_index         INT,                     -- which drill in the day (null for open-run)
  started_at          TIMESTAMPTZ DEFAULT NOW(),
  ended_at            TIMESTAMPTZ,
  duration_seconds    INT,
  total_shots         INT NOT NULL DEFAULT 0,
  makes               INT NOT NULL DEFAULT 0,
  fg_percentage       DECIMAL(5,2),
  best_streak         INT DEFAULT 0,
  avg_release_angle   DECIMAL(5,2),
  avg_arc_height      DECIMAL(6,4),
  best_zone           TEXT,
  best_zone_pct       DECIMAL(5,2),
  worst_zone          TEXT,
  worst_zone_pct      DECIMAL(5,2),
  coach_x_read        TEXT,                    -- Coach X postgame analysis text
  coach_analysis      JSONB,                   -- full analysis JSON from coach-shot-read.js
  session_type        TEXT DEFAULT 'guided',   -- 'guided' | 'open_run'
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- shots — one row per detected shot
-- ============================================================

CREATE TABLE IF NOT EXISTS shots (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id            UUID REFERENCES shot_sessions(id) ON DELETE CASCADE,
  user_id               UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  made                  BOOLEAN NOT NULL,
  shot_index            INT NOT NULL,
  court_x               DECIMAL(6,4),           -- normalized 0..1 (left to right)
  court_y               DECIMAL(6,4),           -- normalized 0..1 (baseline to halfcourt)
  zone                  TEXT,
  release_angle         DECIMAL(5,2),           -- degrees
  arc_height            DECIMAL(6,4),           -- normalized, 0=flat 1=very high
  release_timestamp_ms  BIGINT,
  result_timestamp_ms   BIGINT,
  flight_time_ms        INT,
  user_corrected        BOOLEAN DEFAULT FALSE,  -- true if player tapped to fix
  confidence            DECIMAL(4,3),           -- model confidence 0..1
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE shot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shots ENABLE ROW LEVEL SECURITY;

-- shot_sessions policies
DROP POLICY IF EXISTS "Users can read own shot sessions" ON shot_sessions;
CREATE POLICY "Users can read own shot sessions"
  ON shot_sessions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own shot sessions" ON shot_sessions;
CREATE POLICY "Users can insert own shot sessions"
  ON shot_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own shot sessions" ON shot_sessions;
CREATE POLICY "Users can update own shot sessions"
  ON shot_sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- shots policies
DROP POLICY IF EXISTS "Users can read own shots" ON shots;
CREATE POLICY "Users can read own shots"
  ON shots FOR SELECT
  USING (
    session_id IN (SELECT id FROM shot_sessions WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert own shots" ON shots;
CREATE POLICY "Users can insert own shots"
  ON shots FOR INSERT
  WITH CHECK (
    session_id IN (SELECT id FROM shot_sessions WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update own shots" ON shots;
CREATE POLICY "Users can update own shots"
  ON shots FOR UPDATE
  USING (
    session_id IN (SELECT id FROM shot_sessions WHERE user_id = auth.uid())
  );

-- ============================================================
-- Indexes for common queries
-- ============================================================

CREATE INDEX IF NOT EXISTS shot_sessions_user_id_idx ON shot_sessions(user_id);
CREATE INDEX IF NOT EXISTS shot_sessions_started_at_idx ON shot_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS shots_session_id_idx ON shots(session_id);
CREATE INDEX IF NOT EXISTS shots_user_id_idx ON shots(user_id);
CREATE INDEX IF NOT EXISTS shots_zone_idx ON shots(zone) WHERE zone IS NOT NULL;

-- ============================================================
-- Zone stats view — aggregates by zone across all user shots
-- (used by shotSync.ts getZoneStats())
-- ============================================================

CREATE OR REPLACE VIEW user_zone_stats AS
SELECT
  s.user_id,
  sh.zone,
  COUNT(*) AS attempts,
  SUM(CASE WHEN sh.made THEN 1 ELSE 0 END) AS makes,
  ROUND(
    (SUM(CASE WHEN sh.made THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0)),
    2
  ) AS fg_percentage
FROM shots sh
JOIN shot_sessions s ON sh.session_id = s.id
WHERE sh.zone IS NOT NULL
GROUP BY s.user_id, sh.zone;

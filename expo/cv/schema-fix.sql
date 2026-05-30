-- ============================================================
-- ATHLT shot_sessions Foreign Key Fix
-- ============================================================
--
-- Problem:
--   INSERT into shot_sessions fails with:
--   "insert or update on table 'shot_sessions' violates foreign key
--    constraint 'shot_sessions_user_id_fkey'"
--
--   This happens when shot_sessions.user_id references public.users
--   instead of auth.users. Supabase creates users in auth.users;
--   public.users is empty unless you explicitly sync it.
--
-- Diagnosis:
--   Run this to check which table the FK points to:
--
--   SELECT
--     tc.constraint_name,
--     ccu.table_schema,
--     ccu.table_name,
--     ccu.column_name
--   FROM information_schema.table_constraints tc
--   JOIN information_schema.constraint_column_usage ccu
--     ON tc.constraint_name = ccu.constraint_name
--   WHERE tc.table_name = 'shot_sessions'
--     AND tc.constraint_type = 'FOREIGN KEY';
--
--   If ccu.table_schema = 'public' and ccu.table_name = 'users',
--   apply Option A below. If it already says 'auth', the FK is correct
--   and the issue is something else (see note at bottom).
--
-- ============================================================


-- ============================================================
-- OPTION A (RECOMMENDED): Fix FK to point to auth.users directly
-- ============================================================
--
-- This is the correct approach. Supabase auth users live in auth.users.
-- All references to user_id on app tables should point there.
--
-- Run in Supabase Dashboard → SQL Editor → New Query:

ALTER TABLE public.shot_sessions
  DROP CONSTRAINT IF EXISTS shot_sessions_user_id_fkey;

ALTER TABLE public.shot_sessions
  ADD CONSTRAINT shot_sessions_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Also fix shots table if it has the same problem:
ALTER TABLE public.shots
  DROP CONSTRAINT IF EXISTS shots_user_id_fkey;

ALTER TABLE public.shots
  ADD CONSTRAINT shots_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;


-- ============================================================
-- OPTION B: Create a trigger to sync auth.users → public.users
-- ============================================================
--
-- This maintains a public.users mirror table and is useful if you
-- want to JOIN user data with app tables without hitting auth.users.
-- More complex; only use if you need the public.users table.

-- Step 1: Create public.users if it doesn't exist
CREATE TABLE IF NOT EXISTS public.users (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Step 2: Trigger to auto-insert on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at)
  VALUES (NEW.id, NEW.email, NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Step 3: Backfill existing users
INSERT INTO public.users (id, email, created_at)
SELECT id, email, created_at
FROM auth.users
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- NOTE: If FK already points to auth.users and you still get errors
-- ============================================================
--
-- The user_id aacbc5f0-bf00-440f-9372-5d45e002540c must exist in
-- auth.users. If it does, verify:
--
-- 1. RLS policies aren't blocking the insert. Check:
--    SELECT * FROM pg_policies WHERE tablename = 'shot_sessions';
--
-- 2. The Supabase client is using the user's JWT (not the anon key)
--    when making the insert call.
--
-- 3. Run this to confirm the user exists:
--    SELECT id, email FROM auth.users WHERE id = 'aacbc5f0-bf00-440f-9372-5d45e002540c';

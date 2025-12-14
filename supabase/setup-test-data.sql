-- Setup Test Data for Lord of the Bins
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- ===================================================================
-- 1. CREATE FEEDBACK TABLE (fixes the 404 error)
-- ===================================================================

-- Create feedback table
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('bug', 'feature', 'ui-ux', 'question')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'in-review', 'planned', 'in-progress', 'completed', 'declined')),
  contact_email TEXT,
  screenshot TEXT,
  screenshot_name TEXT,
  votes INTEGER DEFAULT 0,
  user_agent TEXT,
  app_version TEXT,
  current_page TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON public.feedback(category);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (for feedback submission)
DROP POLICY IF EXISTS "Allow anonymous insert" ON public.feedback;
CREATE POLICY "Allow anonymous insert" ON public.feedback
  FOR INSERT TO anon
  WITH CHECK (true);

-- Allow anonymous reads
DROP POLICY IF EXISTS "Allow anonymous read" ON public.feedback;
CREATE POLICY "Allow anonymous read" ON public.feedback
  FOR SELECT TO anon
  USING (true);

-- Allow anonymous updates
DROP POLICY IF EXISTS "Allow anonymous update" ON public.feedback;
CREATE POLICY "Allow anonymous update" ON public.feedback
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- Allow anonymous deletes
DROP POLICY IF EXISTS "Allow anonymous delete" ON public.feedback;
CREATE POLICY "Allow anonymous delete" ON public.feedback
  FOR DELETE TO anon
  USING (true);

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS feedback_updated_at_trigger ON public.feedback;
CREATE TRIGGER feedback_updated_at_trigger
  BEFORE UPDATE ON public.feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_feedback_updated_at();

-- ===================================================================
-- 2. CREATE TEST USERS
-- ===================================================================

-- Note: We need to create users in the auth.users table first, then create profiles

-- Test Team Leader (EMP001)
DO $$
DECLARE
  user_id_emp001 UUID;
BEGIN
  -- Check if user already exists
  SELECT id INTO user_id_emp001 FROM auth.users WHERE email = 'emp001@lotb.local';

  IF user_id_emp001 IS NULL THEN
    -- Insert into auth.users (this requires superuser privileges)
    -- If this fails, use the Supabase Dashboard Auth > Users > "Add user" instead
    INSERT INTO auth.users (
      id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      role
    ) VALUES (
      gen_random_uuid(),
      'emp001@lotb.local',
      crypt('password123', gen_salt('bf')), -- Bcrypt hash of 'password123'
      NOW(),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      false,
      'authenticated'
    )
    RETURNING id INTO user_id_emp001;

    RAISE NOTICE 'Created auth user: emp001@lotb.local with ID: %', user_id_emp001;
  ELSE
    RAISE NOTICE 'Auth user emp001@lotb.local already exists with ID: %', user_id_emp001;
  END IF;

  -- Create or update profile
  INSERT INTO public.user_profiles (
    id,
    user_code,
    display_name,
    role,
    shift
  ) VALUES (
    user_id_emp001,
    'EMP001',
    'John Smith',
    'Team Leader',
    'Day'
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    shift = EXCLUDED.shift;

  RAISE NOTICE 'Created/updated profile for EMP001';
END $$;

-- Test Team Coordinator (EMP002)
DO $$
DECLARE
  user_id_emp002 UUID;
BEGIN
  SELECT id INTO user_id_emp002 FROM auth.users WHERE email = 'emp002@lotb.local';

  IF user_id_emp002 IS NULL THEN
    INSERT INTO auth.users (
      id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      role
    ) VALUES (
      gen_random_uuid(),
      'emp002@lotb.local',
      crypt('password123', gen_salt('bf')),
      NOW(),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      false,
      'authenticated'
    )
    RETURNING id INTO user_id_emp002;

    RAISE NOTICE 'Created auth user: emp002@lotb.local with ID: %', user_id_emp002;
  ELSE
    RAISE NOTICE 'Auth user emp002@lotb.local already exists with ID: %', user_id_emp002;
  END IF;

  INSERT INTO public.user_profiles (
    id,
    user_code,
    display_name,
    role,
    shift
  ) VALUES (
    user_id_emp002,
    'EMP002',
    'Jane Doe',
    'Team Coordinator',
    'Day'
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    role = EXCLUDED.role,
    shift = EXCLUDED.shift;

  RAISE NOTICE 'Created/updated profile for EMP002';
END $$;

-- ===================================================================
-- 3. VERIFY SETUP
-- ===================================================================

-- List all users
SELECT
  u.id,
  u.email,
  up.user_code,
  up.display_name,
  up.role,
  up.shift,
  u.created_at
FROM auth.users u
LEFT JOIN public.user_profiles up ON u.id = up.id
WHERE u.email LIKE '%@lotb.local'
ORDER BY u.created_at DESC;

-- ===================================================================
-- NOTES
-- ===================================================================

-- If the auth.users INSERT fails with permission error, you have two options:
--
-- OPTION 1: Use Supabase Dashboard (Recommended)
--   1. Go to Authentication > Users in your Supabase dashboard
--   2. Click "Add user"
--   3. Email: emp001@lotb.local
--   4. Password: password123
--   5. Auto Confirm User: YES
--   6. Repeat for emp002@lotb.local
--   7. Then run the user_profiles INSERT statements above
--
-- OPTION 2: Use Supabase Auth API (programmatic)
--   Use the signUp function from @supabase/supabase-js
--   This requires email confirmation unless disabled in project settings
--
-- Login Credentials:
--   Team Leader:      EMP001 / password123  (or emp001@lotb.local / password123)
--   Team Coordinator: EMP002 / password123  (or emp002@lotb.local / password123)

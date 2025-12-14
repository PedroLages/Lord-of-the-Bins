-- Migration: Create feedback table for user submissions
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- Create feedback table
CREATE TABLE IF NOT EXISTS feedback (
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
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON feedback(category);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

-- Enable Row Level Security
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (for feedback submission)
CREATE POLICY "Allow anonymous insert" ON feedback
  FOR INSERT TO anon
  WITH CHECK (true);

-- Allow anonymous reads (for viewing feedback in admin)
CREATE POLICY "Allow anonymous read" ON feedback
  FOR SELECT TO anon
  USING (true);

-- Allow anonymous updates (for status changes)
CREATE POLICY "Allow anonymous update" ON feedback
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- Allow anonymous deletes (for admin cleanup)
CREATE POLICY "Allow anonymous delete" ON feedback
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
DROP TRIGGER IF EXISTS feedback_updated_at_trigger ON feedback;
CREATE TRIGGER feedback_updated_at_trigger
  BEFORE UPDATE ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_feedback_updated_at();

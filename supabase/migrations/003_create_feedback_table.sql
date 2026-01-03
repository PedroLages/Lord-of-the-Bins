-- Create feedback table for user feedback and bug reports
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  shift_id TEXT NOT NULL,

  -- Feedback content
  category TEXT NOT NULL CHECK (category IN ('bug', 'feature', 'improvement', 'question', 'other')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'wont_fix')),

  -- Optional fields
  contact_email TEXT,
  screenshot TEXT, -- Base64 encoded image
  screenshot_name TEXT,

  -- Metadata
  votes INTEGER DEFAULT 0,
  user_agent TEXT,
  app_version TEXT,
  current_page TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_shift_id ON public.feedback(shift_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_category ON public.feedback(category);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see/manage feedback from their shift
CREATE POLICY "Users can view feedback from their shift"
  ON public.feedback FOR SELECT
  USING (shift_id = current_setting('app.current_shift_id', true));

CREATE POLICY "Users can insert feedback to their shift"
  ON public.feedback FOR INSERT
  WITH CHECK (shift_id = current_setting('app.current_shift_id', true));

CREATE POLICY "Users can update feedback from their shift"
  ON public.feedback FOR UPDATE
  USING (shift_id = current_setting('app.current_shift_id', true))
  WITH CHECK (shift_id = current_setting('app.current_shift_id', true));

CREATE POLICY "Users can delete feedback from their shift"
  ON public.feedback FOR DELETE
  USING (shift_id = current_setting('app.current_shift_id', true));

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_feedback_updated_at_trigger
  BEFORE UPDATE ON public.feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_feedback_updated_at();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback TO anon;

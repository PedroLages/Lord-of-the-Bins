-- Add RLS policies for shifts table
-- Allows all authenticated users to read shifts
-- Only Team Leaders can update shift names

-- Enable RLS on shifts table
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read shifts
CREATE POLICY "Users can read all shifts"
  ON shifts FOR SELECT
  TO authenticated
  USING (true);

-- Only Team Leaders can update shift names
CREATE POLICY "Team Leaders can update shifts"
  ON shifts FOR UPDATE
  TO authenticated
  USING (get_user_role() = 'Team Leader')
  WITH CHECK (get_user_role() = 'Team Leader');

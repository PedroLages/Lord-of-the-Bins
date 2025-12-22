-- Allow new users to create their profile when accepting an invite
-- This policy allows authenticated users (who just created their auth account)
-- to INSERT into the users table when they're creating their own profile

CREATE POLICY "Users can create profile via invite"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    -- The user must be inserting their own profile (id must match auth.uid())
    id = auth.uid()
  );

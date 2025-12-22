-- Fix: Allow newly created users to mark invite tokens as 'used'
--
-- Bug: The existing UPDATE policy only allows Team Leaders to update tokens.
-- When a new TC accepts an invite, they can't mark it as 'used' because they
-- don't have Team Leader role and RLS blocks the UPDATE.
--
-- Solution: Create a database function with SECURITY DEFINER that bypasses RLS
-- for the specific operation of marking a token as 'used'.

-- Function to mark an invite token as used (bypasses RLS with SECURITY DEFINER)
CREATE OR REPLACE FUNCTION mark_invite_token_as_used(
  token_id UUID,
  user_id UUID
) RETURNS void AS $$
BEGIN
  UPDATE invite_tokens
  SET
    status = 'used',
    used_by = user_id,
    used_at = NOW()
  WHERE
    id = token_id
    AND status = 'active'  -- Only allow marking active tokens
    AND expires_at > NOW(); -- Only allow non-expired tokens

  -- Raise exception if no row was updated
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token not found or already used/expired';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION mark_invite_token_as_used(UUID, UUID) TO authenticated;

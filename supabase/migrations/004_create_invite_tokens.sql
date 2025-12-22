-- Invite Tokens Table
-- Allows Team Leaders to generate secure invite links for new TCs

CREATE TABLE IF NOT EXISTS invite_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('Team Leader', 'TC')),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_by UUID REFERENCES users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('active', 'used', 'expired', 'revoked')) DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invite_tokens_token ON invite_tokens(token);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_shift_id ON invite_tokens(shift_id);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_created_by ON invite_tokens(created_by);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_status ON invite_tokens(status);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_expires_at ON invite_tokens(expires_at);

-- Enable RLS
ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;

-- Team Leaders can view invite tokens for their shift
CREATE POLICY "Team Leaders can view their shift's invite tokens"
  ON invite_tokens FOR SELECT
  TO authenticated
  USING (shift_id = get_user_shift_id() AND get_user_role() = 'Team Leader');

-- Team Leaders can create invite tokens for their shift
CREATE POLICY "Team Leaders can create invite tokens"
  ON invite_tokens FOR INSERT
  TO authenticated
  WITH CHECK (
    shift_id = get_user_shift_id() AND
    get_user_role() = 'Team Leader' AND
    created_by = auth.uid()
  );

-- Team Leaders can update invite tokens (revoke)
CREATE POLICY "Team Leaders can update their shift's invite tokens"
  ON invite_tokens FOR UPDATE
  TO authenticated
  USING (shift_id = get_user_shift_id() AND get_user_role() = 'Team Leader')
  WITH CHECK (shift_id = get_user_shift_id() AND get_user_role() = 'Team Leader');

-- Anyone (including anonymous users) can view active tokens for validation
CREATE POLICY "Public can view active tokens by token value"
  ON invite_tokens FOR SELECT
  TO anon, authenticated
  USING (status = 'active' AND expires_at > NOW());

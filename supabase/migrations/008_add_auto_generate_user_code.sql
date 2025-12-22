-- Auto-generate user codes to prevent conflicts
--
-- Generates the next available user code for a given shift and role.
-- Format: TC001, TC002, TL001, etc.
--
-- This function:
-- 1. Finds the highest existing number for the given role prefix
-- 2. Increments it by 1
-- 3. Returns formatted code with zero-padding

CREATE OR REPLACE FUNCTION generate_user_code(
  p_shift_id UUID,
  p_role TEXT
) RETURNS TEXT AS $$
DECLARE
  role_prefix TEXT;
  max_number INT;
  next_number INT;
BEGIN
  -- Determine role prefix
  role_prefix := CASE
    WHEN p_role = 'Team Leader' THEN 'TL'
    WHEN p_role = 'TC' THEN 'TC'
    ELSE 'USR' -- Fallback
  END;

  -- Find the maximum number currently in use for this role in this shift
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(user_code FROM '[0-9]+$') AS INT
      )
    ),
    0
  ) INTO max_number
  FROM users
  WHERE shift_id = p_shift_id
    AND user_code LIKE role_prefix || '%'
    AND user_code ~ (role_prefix || '[0-9]+$');  -- Only match codes ending with digits

  -- Increment to get next number
  next_number := max_number + 1;

  -- Return formatted code with zero-padding (3 digits)
  RETURN role_prefix || LPAD(next_number::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION generate_user_code(UUID, TEXT) TO authenticated;

-- Also grant to anon for invite acceptance (user isn't authenticated yet when code is generated)
GRANT EXECUTE ON FUNCTION generate_user_code(UUID, TEXT) TO anon;

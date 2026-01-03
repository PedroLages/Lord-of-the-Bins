-- Fix schedules UPDATE policy to support UPSERT operations during cloud sync
-- The USING clause restricts which existing rows can be updated (respects lock)
-- The WITH CHECK clause validates new rows being inserted/updated (allows sync)

-- Drop the existing UPDATE policy
DROP POLICY IF EXISTS "Users update own shift schedules" ON schedules;

-- Recreate with both USING and WITH CHECK clauses
CREATE POLICY "Users update own shift schedules"
  ON schedules FOR UPDATE
  USING (
    -- Can only UPDATE existing schedules that are unlocked OR user is Team Leader
    shift_id = get_user_shift_id() AND
    (locked = FALSE OR get_user_role() = 'Team Leader')
  )
  WITH CHECK (
    -- Can UPSERT any schedule for own shift (needed for cloud sync)
    shift_id = get_user_shift_id()
  );

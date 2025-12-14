-- ============================================================================
-- MIGRATION: Create Row Level Security Policies
-- Description: Enforces shift isolation - users can only see their shift's data
-- ============================================================================

-- Helper function to get the current user's shift_id
CREATE OR REPLACE FUNCTION get_user_shift_id()
RETURNS UUID AS $$
  SELECT shift_id FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- Helper function to check if user is Team Leader
CREATE OR REPLACE FUNCTION is_team_leader()
RETURNS BOOLEAN AS $$
  SELECT role = 'Team Leader' FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- =============================================================================
-- ENABLE RLS ON ALL TABLES
-- =============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduling_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- USERS TABLE POLICIES
-- =============================================================================

-- Users can see users in their own shift
CREATE POLICY "Users see own shift users"
  ON users FOR SELECT
  USING (shift_id = get_user_shift_id());

-- Users can update their own profile
CREATE POLICY "Users update own profile"
  ON users FOR UPDATE
  USING (id = auth.uid());

-- =============================================================================
-- OPERATORS TABLE POLICIES
-- =============================================================================

-- Users can only see operators from their shift
CREATE POLICY "Users see own shift operators"
  ON operators FOR SELECT
  USING (shift_id = get_user_shift_id());

-- Users can insert operators into their shift
CREATE POLICY "Users insert own shift operators"
  ON operators FOR INSERT
  WITH CHECK (shift_id = get_user_shift_id());

-- Users can update operators in their shift
CREATE POLICY "Users update own shift operators"
  ON operators FOR UPDATE
  USING (shift_id = get_user_shift_id());

-- Team Leaders can delete operators, TCs can only archive
CREATE POLICY "Team Leaders delete operators"
  ON operators FOR DELETE
  USING (
    shift_id = get_user_shift_id() AND
    is_team_leader()
  );

-- =============================================================================
-- TASKS TABLE POLICIES
-- =============================================================================

-- Users can only see tasks from their shift
CREATE POLICY "Users see own shift tasks"
  ON tasks FOR SELECT
  USING (shift_id = get_user_shift_id());

-- Users can insert tasks into their shift
CREATE POLICY "Users insert own shift tasks"
  ON tasks FOR INSERT
  WITH CHECK (shift_id = get_user_shift_id());

-- Users can update tasks in their shift
CREATE POLICY "Users update own shift tasks"
  ON tasks FOR UPDATE
  USING (shift_id = get_user_shift_id());

-- Team Leaders can delete tasks
CREATE POLICY "Team Leaders delete tasks"
  ON tasks FOR DELETE
  USING (
    shift_id = get_user_shift_id() AND
    is_team_leader()
  );

-- =============================================================================
-- TASK REQUIREMENTS TABLE POLICIES
-- =============================================================================

-- Users can see task requirements from their shift
CREATE POLICY "Users see own shift task requirements"
  ON task_requirements FOR SELECT
  USING (shift_id = get_user_shift_id());

-- Users can modify task requirements in their shift
CREATE POLICY "Users modify own shift task requirements"
  ON task_requirements FOR ALL
  USING (shift_id = get_user_shift_id())
  WITH CHECK (shift_id = get_user_shift_id());

-- =============================================================================
-- SCHEDULES TABLE POLICIES
-- =============================================================================

-- Users can see schedules from their shift
CREATE POLICY "Users see own shift schedules"
  ON schedules FOR SELECT
  USING (shift_id = get_user_shift_id());

-- Users can insert schedules into their shift
CREATE POLICY "Users insert own shift schedules"
  ON schedules FOR INSERT
  WITH CHECK (shift_id = get_user_shift_id());

-- Users can update schedules unless locked (Team Leaders can override)
CREATE POLICY "Users update own shift schedules"
  ON schedules FOR UPDATE
  USING (
    shift_id = get_user_shift_id() AND
    (locked = FALSE OR is_team_leader())
  );

-- Team Leaders can delete schedules
CREATE POLICY "Team Leaders delete schedules"
  ON schedules FOR DELETE
  USING (
    shift_id = get_user_shift_id() AND
    is_team_leader()
  );

-- =============================================================================
-- SCHEDULING RULES TABLE POLICIES
-- =============================================================================

-- Users can see scheduling rules from their shift
CREATE POLICY "Users see own shift rules"
  ON scheduling_rules FOR SELECT
  USING (shift_id = get_user_shift_id());

-- Users can insert scheduling rules for their shift (if none exist)
CREATE POLICY "Users insert own shift rules"
  ON scheduling_rules FOR INSERT
  WITH CHECK (shift_id = get_user_shift_id());

-- Users can update scheduling rules for their shift
CREATE POLICY "Users update own shift rules"
  ON scheduling_rules FOR UPDATE
  USING (shift_id = get_user_shift_id());

-- =============================================================================
-- ACTIVITY LOG TABLE POLICIES
-- =============================================================================

-- Users can see activity log from their shift
CREATE POLICY "Users see own shift activity"
  ON activity_log FOR SELECT
  USING (shift_id = get_user_shift_id());

-- Users can insert activity log for their shift
CREATE POLICY "Users insert own shift activity"
  ON activity_log FOR INSERT
  WITH CHECK (shift_id = get_user_shift_id());

-- No one can update or delete activity log (immutable audit trail)
-- (No UPDATE or DELETE policies = no one can modify)

-- =============================================================================
-- SHIFTS TABLE POLICIES (read-only for all authenticated users)
-- =============================================================================

ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

-- All authenticated users can see shifts (for dropdowns, etc.)
CREATE POLICY "Authenticated users see shifts"
  ON shifts FOR SELECT
  USING (auth.role() = 'authenticated');

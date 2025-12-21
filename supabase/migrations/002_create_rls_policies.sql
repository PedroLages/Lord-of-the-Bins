-- Lord of the Bins - Row Level Security Policies
-- Ensures complete shift isolation at the database level

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduling_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- USERS TABLE POLICIES
-- ============================================

-- Users can see their own profile and other users in their shift
CREATE POLICY "Users see own shift users"
  ON users FOR SELECT
  USING (shift_id = get_user_shift_id() OR id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users update own profile"
  ON users FOR UPDATE
  USING (id = auth.uid());

-- ============================================
-- OPERATORS TABLE POLICIES
-- ============================================

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

-- Only Team Leaders can permanently delete operators
CREATE POLICY "Team Leaders delete operators"
  ON operators FOR DELETE
  USING (
    shift_id = get_user_shift_id() AND
    get_user_role() = 'Team Leader'
  );

-- ============================================
-- TASKS TABLE POLICIES
-- ============================================

CREATE POLICY "Users see own shift tasks"
  ON tasks FOR SELECT
  USING (shift_id = get_user_shift_id());

CREATE POLICY "Users insert own shift tasks"
  ON tasks FOR INSERT
  WITH CHECK (shift_id = get_user_shift_id());

CREATE POLICY "Users update own shift tasks"
  ON tasks FOR UPDATE
  USING (shift_id = get_user_shift_id());

CREATE POLICY "Team Leaders delete tasks"
  ON tasks FOR DELETE
  USING (
    shift_id = get_user_shift_id() AND
    get_user_role() = 'Team Leader'
  );

-- ============================================
-- TASK REQUIREMENTS POLICIES
-- ============================================

CREATE POLICY "Users see own shift task requirements"
  ON task_requirements FOR SELECT
  USING (shift_id = get_user_shift_id());

CREATE POLICY "Users manage own shift task requirements"
  ON task_requirements FOR ALL
  USING (shift_id = get_user_shift_id())
  WITH CHECK (shift_id = get_user_shift_id());

-- ============================================
-- SCHEDULES TABLE POLICIES
-- ============================================

CREATE POLICY "Users see own shift schedules"
  ON schedules FOR SELECT
  USING (shift_id = get_user_shift_id());

CREATE POLICY "Users insert own shift schedules"
  ON schedules FOR INSERT
  WITH CHECK (shift_id = get_user_shift_id());

-- Users can update unlocked schedules; Team Leaders can update any
CREATE POLICY "Users update own shift schedules"
  ON schedules FOR UPDATE
  USING (
    shift_id = get_user_shift_id() AND
    (locked = FALSE OR get_user_role() = 'Team Leader')
  );

-- Only Team Leaders can delete schedules
CREATE POLICY "Team Leaders delete schedules"
  ON schedules FOR DELETE
  USING (
    shift_id = get_user_shift_id() AND
    get_user_role() = 'Team Leader'
  );

-- ============================================
-- SCHEDULING RULES POLICIES
-- ============================================

CREATE POLICY "Users see own shift rules"
  ON scheduling_rules FOR SELECT
  USING (shift_id = get_user_shift_id());

CREATE POLICY "Users manage own shift rules"
  ON scheduling_rules FOR ALL
  USING (shift_id = get_user_shift_id())
  WITH CHECK (shift_id = get_user_shift_id());

-- ============================================
-- ACTIVITY LOG POLICIES
-- ============================================

CREATE POLICY "Users see own shift activity"
  ON activity_log FOR SELECT
  USING (shift_id = get_user_shift_id());

CREATE POLICY "Users insert own shift activity"
  ON activity_log FOR INSERT
  WITH CHECK (shift_id = get_user_shift_id());

-- Activity log is append-only (no update/delete)

-- ============================================
-- APP SETTINGS POLICIES
-- ============================================

CREATE POLICY "Users see own shift settings"
  ON app_settings FOR SELECT
  USING (shift_id = get_user_shift_id());

CREATE POLICY "Users manage own shift settings"
  ON app_settings FOR ALL
  USING (shift_id = get_user_shift_id())
  WITH CHECK (shift_id = get_user_shift_id());

-- ============================================
-- REALTIME CONFIGURATION
-- ============================================

-- Enable realtime for collaborative features
ALTER PUBLICATION supabase_realtime ADD TABLE schedules;
ALTER PUBLICATION supabase_realtime ADD TABLE operators;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;

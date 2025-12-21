-- Lord of the Bins - Supabase Schema V2
-- Hybrid Architecture: Local-first with cloud sync

-- ============================================
-- CORE TABLES
-- ============================================

-- Shifts table (Shift A, Shift B)
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial shifts
INSERT INTO shifts (name) VALUES ('Shift A'), ('Shift B')
ON CONFLICT (name) DO NOTHING;

-- Users table (Team Leaders and TCs)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_code TEXT NOT NULL UNIQUE,
  email TEXT,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Team Leader', 'TC')),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_user_code ON users(user_code);
CREATE INDEX IF NOT EXISTS idx_users_shift_id ON users(shift_id);

-- Operators table (warehouse staff)
CREATE TABLE IF NOT EXISTS operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id TEXT, -- Maps to original IndexedDB ID for sync
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  employee_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('Regular', 'Flex', 'Coordinator')),
  status TEXT NOT NULL CHECK (status IN ('Active', 'Leave', 'Sick', 'Training', 'Holiday')) DEFAULT 'Active',
  skills TEXT[] NOT NULL DEFAULT '{}',
  availability JSONB DEFAULT '{"Mon": true, "Tue": true, "Wed": true, "Thu": true, "Fri": true}',
  preferred_tasks TEXT[] DEFAULT '{}',
  archived BOOLEAN DEFAULT FALSE,
  sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operators_shift_id ON operators(shift_id);
CREATE INDEX IF NOT EXISTS idx_operators_archived ON operators(archived);
CREATE INDEX IF NOT EXISTS idx_operators_type ON operators(type);
CREATE INDEX IF NOT EXISTS idx_operators_local_id ON operators(local_id);

-- Tasks table (skills/stations)
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id TEXT, -- Maps to original IndexedDB ID
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  required_skill TEXT NOT NULL,
  color TEXT NOT NULL,
  text_color TEXT DEFAULT 'white',
  is_heavy BOOLEAN DEFAULT FALSE,
  is_coordinator_only BOOLEAN DEFAULT FALSE,
  archived BOOLEAN DEFAULT FALSE,
  sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shift_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tasks_shift_id ON tasks(shift_id);
CREATE INDEX IF NOT EXISTS idx_tasks_archived ON tasks(archived);
CREATE INDEX IF NOT EXISTS idx_tasks_local_id ON tasks(local_id);

-- Task Requirements table (staffing per task)
CREATE TABLE IF NOT EXISTS task_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id TEXT,
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT TRUE,
  default_requirements JSONB NOT NULL DEFAULT '[]',
  daily_overrides JSONB DEFAULT '{}',
  sync_status TEXT DEFAULT 'synced',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shift_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_task_requirements_shift_id ON task_requirements(shift_id);
CREATE INDEX IF NOT EXISTS idx_task_requirements_task_id ON task_requirements(task_id);

-- Schedules table (weekly schedules)
CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id TEXT,
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
  week_start_date DATE NOT NULL,
  week_label TEXT, -- e.g., "Week 51"
  status TEXT NOT NULL CHECK (status IN ('Draft', 'Published')) DEFAULT 'Draft',
  locked BOOLEAN DEFAULT FALSE,
  assignments JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES users(id),
  published_by UUID REFERENCES users(id),
  published_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'synced',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shift_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_schedules_shift_id ON schedules(shift_id);
CREATE INDEX IF NOT EXISTS idx_schedules_week_start_date ON schedules(week_start_date);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status);

-- Scheduling Rules table (algorithm settings)
CREATE TABLE IF NOT EXISTS scheduling_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT UNIQUE,
  algorithm TEXT DEFAULT 'max-matching' CHECK (algorithm IN ('greedy', 'greedy-tabu', 'multi-objective', 'max-matching')),
  strict_skill_matching BOOLEAN DEFAULT TRUE,
  allow_consecutive_heavy_shifts BOOLEAN DEFAULT FALSE,
  prioritize_flex_for_exceptions BOOLEAN DEFAULT TRUE,
  respect_preferred_stations BOOLEAN DEFAULT TRUE,
  max_consecutive_days_on_same_task INTEGER DEFAULT 3,
  fair_distribution BOOLEAN DEFAULT TRUE,
  balance_workload BOOLEAN DEFAULT TRUE,
  auto_assign_coordinators BOOLEAN DEFAULT TRUE,
  randomization_factor INTEGER DEFAULT 10,
  prioritize_skill_variety BOOLEAN DEFAULT TRUE,
  sync_status TEXT DEFAULT 'synced',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduling_rules_shift_id ON scheduling_rules(shift_id);

-- Activity Log table (audit trail)
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_name TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_shift_id ON activity_log(shift_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);

-- App Settings table (per-shift settings like theme, appearance)
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT UNIQUE,
  theme TEXT DEFAULT 'Modern' CHECK (theme IN ('Modern', 'Midnight')),
  color_palette TEXT DEFAULT 'Default',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get current user's shift ID
CREATE OR REPLACE FUNCTION get_user_shift_id()
RETURNS UUID AS $$
  SELECT shift_id FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users', 'operators', 'tasks', 'task_requirements', 'schedules', 'scheduling_rules', 'app_settings']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON %s', t, t);
    EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t);
  END LOOP;
END $$;

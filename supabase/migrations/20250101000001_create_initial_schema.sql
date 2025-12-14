-- ============================================================================
-- MIGRATION: Create Initial Schema
-- Description: Creates all core tables for Lord of the Bins
-- ============================================================================

-- Create shifts table (Shift A, Shift B)
CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial shifts
INSERT INTO shifts (name) VALUES ('Shift A'), ('Shift B')
ON CONFLICT (name) DO NOTHING;

-- Create users table (extends auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_code TEXT NOT NULL UNIQUE,
  email TEXT,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Team Leader', 'TC')),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_user_code ON users(user_code);
CREATE INDEX IF NOT EXISTS idx_users_shift_id ON users(shift_id);

-- Create operators table
CREATE TABLE IF NOT EXISTS operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  employee_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('Regular', 'Flex', 'Coordinator')),
  status TEXT NOT NULL CHECK (status IN ('Active', 'Leave', 'Sick')),
  skills TEXT[] NOT NULL DEFAULT '{}',
  availability JSONB DEFAULT '{}',
  preferred_tasks TEXT[] DEFAULT '{}',
  archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operators_shift_id ON operators(shift_id);
CREATE INDEX IF NOT EXISTS idx_operators_archived ON operators(archived);
CREATE INDEX IF NOT EXISTS idx_operators_type ON operators(type);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  required_skill TEXT NOT NULL,
  color TEXT NOT NULL,
  is_heavy BOOLEAN DEFAULT FALSE,
  archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shift_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tasks_shift_id ON tasks(shift_id);
CREATE INDEX IF NOT EXISTS idx_tasks_archived ON tasks(archived);

-- Create task_requirements table
CREATE TABLE IF NOT EXISTS task_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT TRUE,
  default_requirements JSONB NOT NULL DEFAULT '[]',
  day_overrides JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shift_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_task_requirements_shift_id ON task_requirements(shift_id);
CREATE INDEX IF NOT EXISTS idx_task_requirements_task_id ON task_requirements(task_id);

-- Create schedules table
CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
  week_start_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Draft', 'Published')) DEFAULT 'Draft',
  locked BOOLEAN DEFAULT FALSE,
  assignments JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES users(id),
  published_by UUID REFERENCES users(id),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shift_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_schedules_shift_id ON schedules(shift_id);
CREATE INDEX IF NOT EXISTS idx_schedules_week_start_date ON schedules(week_start_date);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON schedules(status);

-- Create scheduling_rules table
CREATE TABLE IF NOT EXISTS scheduling_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT UNIQUE,
  strict_skill_matching BOOLEAN DEFAULT TRUE,
  allow_consecutive_heavy_shifts BOOLEAN DEFAULT FALSE,
  prioritize_flex_for_exceptions BOOLEAN DEFAULT TRUE,
  respect_preferred_stations BOOLEAN DEFAULT TRUE,
  max_consecutive_days_on_same_task INTEGER DEFAULT 2,
  fair_distribution BOOLEAN DEFAULT TRUE,
  balance_workload BOOLEAN DEFAULT TRUE,
  auto_assign_coordinators BOOLEAN DEFAULT TRUE,
  randomization_factor INTEGER DEFAULT 0,
  use_v2_algorithm BOOLEAN DEFAULT FALSE,
  prioritize_skill_variety BOOLEAN DEFAULT FALSE,
  algorithm TEXT DEFAULT 'greedy' CHECK (algorithm IN ('greedy', 'greedy-tabu', 'multi-objective', 'max-matching')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduling_rules_shift_id ON scheduling_rules(shift_id);

-- Create activity_log table
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_shift_id ON activity_log(shift_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity_type ON activity_log(entity_type);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers to all tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_operators_updated_at BEFORE UPDATE ON operators
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_task_requirements_updated_at BEFORE UPDATE ON task_requirements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scheduling_rules_updated_at BEFORE UPDATE ON scheduling_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

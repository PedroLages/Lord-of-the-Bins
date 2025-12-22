-- Planning Templates Table
-- Allows users to save and reuse "Plan the Week" configurations
-- Templates are shift-specific and can contain exclusion patterns and rules

CREATE TABLE IF NOT EXISTS planning_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id TEXT, -- Maps to original IndexedDB ID for sync
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  exclusions JSONB NOT NULL DEFAULT '[]', -- Array of TemplateExclusion objects
  rules JSONB DEFAULT '[]', -- Array of PlanningRule objects (NumericStaffingRule | OperatorPairingRule)
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shift_id, name) -- Template names must be unique within a shift
);

CREATE INDEX IF NOT EXISTS idx_planning_templates_shift_id ON planning_templates(shift_id);
CREATE INDEX IF NOT EXISTS idx_planning_templates_local_id ON planning_templates(local_id);
CREATE INDEX IF NOT EXISTS idx_planning_templates_created_by ON planning_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_planning_templates_name ON planning_templates(name);

-- Apply updated_at trigger
CREATE TRIGGER update_planning_templates_updated_at
  BEFORE UPDATE ON planning_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE planning_templates ENABLE ROW LEVEL SECURITY;

-- Users can view templates from their shift
CREATE POLICY "Users can view their shift's planning templates"
  ON planning_templates FOR SELECT
  TO authenticated
  USING (shift_id = get_user_shift_id());

-- Users can create templates for their shift
CREATE POLICY "Users can create planning templates"
  ON planning_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    shift_id = get_user_shift_id() AND
    (created_by IS NULL OR created_by = auth.uid())
  );

-- Users can update templates for their shift
CREATE POLICY "Users can update their shift's planning templates"
  ON planning_templates FOR UPDATE
  TO authenticated
  USING (shift_id = get_user_shift_id())
  WITH CHECK (shift_id = get_user_shift_id());

-- Users can delete templates for their shift
CREATE POLICY "Users can delete their shift's planning templates"
  ON planning_templates FOR DELETE
  TO authenticated
  USING (shift_id = get_user_shift_id());

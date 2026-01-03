-- Add UNIQUE constraint to local_id in planning_templates
-- This allows UPSERT operations to use local_id for conflict resolution

ALTER TABLE planning_templates
  ADD CONSTRAINT planning_templates_local_id_unique UNIQUE (local_id);

-- Add UNIQUE constraint to local_id in task_requirements
-- This allows UPSERT operations to use local_id for conflict resolution

ALTER TABLE task_requirements
  ADD CONSTRAINT task_requirements_local_id_unique UNIQUE (local_id);

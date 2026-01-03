-- Add UNIQUE constraints to local_id in operators, tasks, and schedules
-- This allows UPSERT operations to use local_id for conflict resolution

-- Operators table
ALTER TABLE operators
  ADD CONSTRAINT operators_local_id_unique UNIQUE (local_id);

-- Tasks table
ALTER TABLE tasks
  ADD CONSTRAINT tasks_local_id_unique UNIQUE (local_id);

-- Schedules table
ALTER TABLE schedules
  ADD CONSTRAINT schedules_local_id_unique UNIQUE (local_id);

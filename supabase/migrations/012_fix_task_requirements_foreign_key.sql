-- Fix task_requirements foreign key to use local_id instead of id
-- This allows syncing with local task IDs without needing UUID mapping

-- Drop the existing foreign key constraint
ALTER TABLE task_requirements
  DROP CONSTRAINT task_requirements_task_id_fkey;

-- Change task_id column from UUID to TEXT to match local_id
ALTER TABLE task_requirements
  ALTER COLUMN task_id TYPE TEXT;

-- Add new foreign key constraint referencing tasks.local_id
ALTER TABLE task_requirements
  ADD CONSTRAINT task_requirements_task_id_fkey
    FOREIGN KEY (task_id)
    REFERENCES tasks(local_id)
    ON DELETE CASCADE;

-- Drop the old unique constraint on (shift_id, task_id) since task_id is now TEXT
ALTER TABLE task_requirements
  DROP CONSTRAINT task_requirements_shift_id_task_id_key;

-- Recreate the unique constraint with the new TEXT type
ALTER TABLE task_requirements
  ADD CONSTRAINT task_requirements_shift_id_task_id_key
    UNIQUE (shift_id, task_id);

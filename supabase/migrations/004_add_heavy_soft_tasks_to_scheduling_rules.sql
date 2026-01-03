-- Add heavy_tasks and soft_tasks columns to scheduling_rules table
-- These store arrays of task IDs that are categorized as heavy or soft tasks

ALTER TABLE public.scheduling_rules
  ADD COLUMN IF NOT EXISTS heavy_tasks TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS soft_tasks TEXT[] DEFAULT '{}';

-- Add comments for documentation
COMMENT ON COLUMN public.scheduling_rules.heavy_tasks IS 'Array of task IDs that are categorized as heavy/demanding tasks (e.g., Troubleshooter, Exceptions)';
COMMENT ON COLUMN public.scheduling_rules.soft_tasks IS 'Array of task IDs that are categorized as soft/light tasks (e.g., People, Process, Off-Process)';

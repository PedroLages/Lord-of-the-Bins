-- Add local_id column to scheduling_rules table for sync queue compatibility
-- This column is used by the hybrid storage sync system to identify and update records

ALTER TABLE public.scheduling_rules
  ADD COLUMN IF NOT EXISTS local_id TEXT UNIQUE;

-- Create index for faster lookups during sync
CREATE INDEX IF NOT EXISTS idx_scheduling_rules_local_id ON public.scheduling_rules(local_id);

-- Add comment for documentation
COMMENT ON COLUMN public.scheduling_rules.local_id IS 'Local identifier used by sync queue for updates (always "rules" for scheduling_rules)';

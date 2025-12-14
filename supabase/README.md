# Supabase Migrations

This directory contains SQL migrations for the Lord of the Bins database schema.

## Files

1. **`20250101000001_create_initial_schema.sql`** - Creates all tables, indexes, and triggers
2. **`20250101000002_create_rls_policies.sql`** - Creates Row Level Security policies for shift isolation

## How to Apply Migrations

### Option 1: Supabase Dashboard (Easiest)

1. Go to your Supabase project dashboard
2. Click **SQL Editor** in the sidebar
3. Click **New query**
4. Copy and paste the contents of `20250101000001_create_initial_schema.sql`
5. Click **Run** button
6. Repeat for `20250101000002_create_rls_policies.sql`

### Option 2: Supabase CLI (Recommended for production)

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

### Option 3: Using MCP Plugin (if configured)

If you have the Supabase MCP plugin configured, you can apply migrations programmatically:

```typescript
await mcp__supabase__apply_migration({
  name: "create_initial_schema",
  query: `<contents of 20250101000001_create_initial_schema.sql>`
});

await mcp__supabase__apply_migration({
  name: "create_rls_policies",
  query: `<contents of 20250101000002_create_rls_policies.sql>`
});
```

## Verification

After applying migrations, verify they worked:

1. Go to **Database** → **Tables** in Supabase dashboard
2. You should see 8 tables: `shifts`, `users`, `operators`, `tasks`, `task_requirements`, `schedules`, `scheduling_rules`, `activity_log`
3. Click on any table → **Policies** tab
4. Verify RLS is enabled and policies are present

## Testing RLS Policies

You can test that shift isolation works by creating two test users:

```sql
-- This will be done via the application's signup flow
-- But you can test manually if needed
```

## Next Steps

After migrations are applied:
1. Generate TypeScript types: `npx supabase gen types typescript --project-id your-project-ref > services/supabase/types.ts`
2. Create seed data (demo users, operators, tasks)
3. Test authentication flow
4. Build the application integration

## Rollback

If you need to rollback:

```sql
-- Drop all tables (WARNING: This deletes all data!)
DROP TABLE IF EXISTS activity_log CASCADE;
DROP TABLE IF EXISTS scheduling_rules CASCADE;
DROP TABLE IF EXISTS schedules CASCADE;
DROP TABLE IF EXISTS task_requirements CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS operators CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS shifts CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS get_user_shift_id() CASCADE;
DROP FUNCTION IF EXISTS is_team_leader() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
```

## Schema Overview

```
shifts (2 rows: Shift A, Shift B)
  ├─> users (Team Leaders and TCs)
  ├─> operators (warehouse staff)
  ├─> tasks (stations/tasks)
  │    └─> task_requirements (staffing needs)
  ├─> schedules (weekly schedules)
  ├─> scheduling_rules (algorithm config)
  └─> activity_log (audit trail)
```

All tables have RLS policies that enforce shift isolation.
Users can ONLY see data from their assigned shift.

# Supabase Setup Guide

## Quick Start

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Choose a region close to your users (EU West recommended)
3. Wait for the project to be provisioned (~2 minutes)

### 2. Get Credentials

1. Go to **Project Settings** → **API**
2. Copy:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJ...`

### 3. Configure Environment

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your actual values
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Apply Migrations

In the Supabase Dashboard:

1. Go to **SQL Editor**
2. Click **+ New query**
3. Copy and paste contents of `migrations/001_create_schema.sql`
4. Click **Run**
5. Repeat for `migrations/002_create_rls_policies.sql`
6. Repeat for `migrations/003_create_feedback_table.sql`
7. Repeat for `migrations/004_add_heavy_soft_tasks_to_scheduling_rules.sql`
8. Repeat for `migrations/005_add_local_id_to_scheduling_rules.sql`

Or use Supabase CLI:

```bash
# Install CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

### 5. Verify Setup

Run this query to check tables:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';
```

You should see: `shifts`, `users`, `operators`, `tasks`, `task_requirements`, `schedules`, `scheduling_rules`, `activity_log`, `app_settings`, `feedback`

## Database Schema

### Tables Overview

| Table | Purpose |
|-------|---------|
| `shifts` | Shift definitions (A, B) |
| `users` | Team Leaders and TCs |
| `operators` | Warehouse operators |
| `tasks` | Skills/stations |
| `task_requirements` | Staffing requirements |
| `schedules` | Weekly schedules |
| `scheduling_rules` | Algorithm settings |
| `activity_log` | Audit trail |
| `app_settings` | Theme, preferences |
| `feedback` | User feedback & bug reports |

### Row Level Security

All tables have RLS policies that:
- Users only see data from their shift
- Team Leaders can delete, TCs can only archive
- Schedules can only be edited if not locked

### Realtime

The following tables are enabled for real-time sync:
- `schedules` - Live schedule updates
- `operators` - Operator changes
- `tasks` - Task/skill changes

## Offline Support

The app works without Supabase configured:
- All data stored in IndexedDB
- No cloud sync or collaboration
- Perfect for single-user or demo mode

When Supabase is configured:
- IndexedDB is primary storage (instant)
- Changes sync to Supabase in background
- Real-time updates from other users

## Troubleshooting

### "Supabase is not configured"

Check that:
1. `.env` file exists in project root
2. Both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
3. Restart dev server after changing `.env`

### RLS Policy Errors

If you get permission errors:
1. Check that migrations were applied in order
2. Verify the user is authenticated
3. Check the user's shift_id matches the data

### Connection Issues

If Supabase is unreachable:
- App continues working with IndexedDB
- Changes queue for sync when connection restored
- Sync status indicator shows offline state

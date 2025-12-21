# Supabase Integration Plan - Lord of the Bins

## 🎯 Executive Summary

**Goal**: Migrate from IndexedDB to Supabase for multi-user collaboration, authentication, and cloud persistence.

**Key Requirements**:
- ✅ Multi-shift isolation (Shift A cannot see Shift B data)
- ✅ Role-based access (Team Leader vs TC permissions)
- ✅ Real-time collaboration (multiple TCs editing simultaneously)
- ✅ User Code authentication (`EMP001` + password)
- ✅ Seamless migration from existing IndexedDB storage
- ✅ Type-safe integration with auto-generated TypeScript types

---

## 📋 Phase 1: Supabase Project Setup

### 1.1 Create Supabase Project
**Objective**: Set up cloud database and get credentials

**Steps**:
1. Go to [supabase.com](https://supabase.com) and create new project
2. Name: `lord-of-the-bins-prod` (or your preference)
3. Generate strong database password
4. Choose region closest to users (Europe recommended)
5. Wait for provisioning (~2 minutes)

**Deliverables**:
- Project URL: `https://[project-ref].supabase.co`
- Public anon key: `eyJ...` (publishable key)
- Service role key: `eyJ...` (secret key - DO NOT commit!)

**MCP Commands**:
```bash
# Get project URL and keys
mcp__supabase__get_project_url
mcp__supabase__get_publishable_keys
```

---

### 1.2 Environment Configuration
**Objective**: Store credentials securely

**Steps**:
1. Create `.env` file in project root:
   ```env
   VITE_SUPABASE_URL=https://[project-ref].supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

2. Add to `.gitignore`:
   ```
   .env
   .env.local
   .env.production
   ```

3. Create `.env.example` for team:
   ```env
   VITE_SUPABASE_URL=your_project_url_here
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```

**Deliverables**:
- `.env` file (gitignored)
- `.env.example` (committed)

---

### 1.3 Install Dependencies
**Objective**: Add Supabase client libraries

**Commands**:
```bash
npm install @supabase/supabase-js
npm install -D @supabase/auth-helpers-react  # Optional: React helpers
```

**Files to create**:
- `services/supabase/client.ts` - Supabase client singleton
- `services/supabase/types.ts` - Auto-generated types (later)

---

## 📋 Phase 2: Database Schema Design

### 2.1 Core Tables Architecture

#### Table: `shifts`
**Purpose**: Define shifts (Shift A, Shift B)

```sql
CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE, -- "Shift A", "Shift B"
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial data
INSERT INTO shifts (name) VALUES ('Shift A'), ('Shift B');
```

#### Table: `users`
**Purpose**: Authentication and user profiles

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_code TEXT NOT NULL UNIQUE, -- "EMP001", "TC-GIEDRIUS"
  email TEXT, -- Optional, for password reset
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Team Leader', 'TC')),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_user_code ON users(user_code);
CREATE INDEX idx_users_shift_id ON users(shift_id);
```

#### Table: `operators`
**Purpose**: Warehouse staff who get scheduled

```sql
CREATE TABLE operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  employee_id TEXT, -- External system ID
  type TEXT NOT NULL CHECK (type IN ('Regular', 'Flex', 'Coordinator')),
  status TEXT NOT NULL CHECK (status IN ('Active', 'Leave', 'Sick')),
  skills TEXT[] NOT NULL DEFAULT '{}', -- Array of skill names
  availability JSONB DEFAULT '{}', -- { "Mon": true, "Tue": false, ... }
  preferred_tasks TEXT[] DEFAULT '{}',
  archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_operators_shift_id ON operators(shift_id);
CREATE INDEX idx_operators_archived ON operators(archived);
CREATE INDEX idx_operators_type ON operators(type);
```

#### Table: `tasks`
**Purpose**: Warehouse tasks/stations

```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  required_skill TEXT NOT NULL,
  color TEXT NOT NULL, -- Hex color code
  is_heavy BOOLEAN DEFAULT FALSE, -- Heavy tasks: Troubleshooter, Exceptions
  archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shift_id, name) -- Task names unique per shift
);

CREATE INDEX idx_tasks_shift_id ON tasks(shift_id);
CREATE INDEX idx_tasks_archived ON tasks(archived);
```

#### Table: `task_requirements`
**Purpose**: How many operators needed per task per day

```sql
CREATE TABLE task_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT TRUE,

  -- Default requirements (array of { type: 'Regular' | 'Flex', count: number })
  default_requirements JSONB NOT NULL DEFAULT '[]',

  -- Day-specific overrides (optional)
  day_overrides JSONB DEFAULT '{}', -- { "Mon": [...], "Tue": [...] }

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shift_id, task_id)
);

CREATE INDEX idx_task_requirements_shift_id ON task_requirements(shift_id);
CREATE INDEX idx_task_requirements_task_id ON task_requirements(task_id);
```

#### Table: `schedules`
**Purpose**: Weekly schedules with daily assignments

```sql
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
  week_start_date DATE NOT NULL, -- Monday of the week
  status TEXT NOT NULL CHECK (status IN ('Draft', 'Published')) DEFAULT 'Draft',
  locked BOOLEAN DEFAULT FALSE,

  -- Assignments structure: { [operatorId]: { "Mon": { taskId, pinned, locked }, ... } }
  assignments JSONB NOT NULL DEFAULT '{}',

  -- Metadata
  created_by UUID REFERENCES users(id),
  published_by UUID REFERENCES users(id),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(shift_id, week_start_date)
);

CREATE INDEX idx_schedules_shift_id ON schedules(shift_id);
CREATE INDEX idx_schedules_week_start_date ON schedules(week_start_date);
CREATE INDEX idx_schedules_status ON schedules(status);
```

#### Table: `scheduling_rules`
**Purpose**: Per-shift configuration for scheduling algorithm

```sql
CREATE TABLE scheduling_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT UNIQUE,

  -- Rules (matches SchedulingRules interface)
  strict_skill_matching BOOLEAN DEFAULT TRUE,
  allow_consecutive_heavy_shifts BOOLEAN DEFAULT FALSE,
  prioritize_flex_for_exceptions BOOLEAN DEFAULT TRUE,
  respect_preferred_stations BOOLEAN DEFAULT TRUE,
  max_consecutive_days_on_same_task INTEGER DEFAULT 2,
  fair_distribution BOOLEAN DEFAULT TRUE,
  balance_workload BOOLEAN DEFAULT TRUE,
  auto_assign_coordinators BOOLEAN DEFAULT TRUE,
  randomization_factor INTEGER DEFAULT 0, -- 0-20
  use_v2_algorithm BOOLEAN DEFAULT FALSE,
  prioritize_skill_variety BOOLEAN DEFAULT FALSE,
  algorithm TEXT DEFAULT 'greedy' CHECK (algorithm IN ('greedy', 'greedy-tabu', 'multi-objective', 'max-matching')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scheduling_rules_shift_id ON scheduling_rules(shift_id);
```

#### Table: `activity_log`
**Purpose**: Audit trail of all changes

```sql
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL, -- "schedule_created", "operator_updated", etc.
  entity_type TEXT NOT NULL, -- "schedule", "operator", "task", etc.
  entity_id UUID, -- ID of affected entity
  details JSONB DEFAULT '{}', -- Additional context
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_log_shift_id ON activity_log(shift_id);
CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX idx_activity_log_entity_type ON activity_log(entity_type);
```

---

### 2.2 Row Level Security (RLS) Policies

**Critical**: Users must ONLY see data from their shift

#### Enable RLS on all tables:
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduling_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
```

#### Helper function to get user's shift:
```sql
CREATE OR REPLACE FUNCTION get_user_shift_id()
RETURNS UUID AS $$
  SELECT shift_id FROM users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;
```

#### RLS Policies for `operators`:
```sql
-- Users can only see operators from their shift
CREATE POLICY "Users see own shift operators"
  ON operators FOR SELECT
  USING (shift_id = get_user_shift_id());

-- Users can insert operators into their shift
CREATE POLICY "Users insert own shift operators"
  ON operators FOR INSERT
  WITH CHECK (shift_id = get_user_shift_id());

-- Users can update operators in their shift
CREATE POLICY "Users update own shift operators"
  ON operators FOR UPDATE
  USING (shift_id = get_user_shift_id());

-- Team Leaders can delete, TCs can only soft-delete (archive)
CREATE POLICY "Users delete own shift operators"
  ON operators FOR DELETE
  USING (
    shift_id = get_user_shift_id() AND
    (SELECT role FROM users WHERE id = auth.uid()) = 'Team Leader'
  );
```

#### RLS Policies for `tasks`:
```sql
CREATE POLICY "Users see own shift tasks"
  ON tasks FOR SELECT
  USING (shift_id = get_user_shift_id());

CREATE POLICY "Users insert own shift tasks"
  ON tasks FOR INSERT
  WITH CHECK (shift_id = get_user_shift_id());

CREATE POLICY "Users update own shift tasks"
  ON tasks FOR UPDATE
  USING (shift_id = get_user_shift_id());

CREATE POLICY "Team Leaders delete tasks"
  ON tasks FOR DELETE
  USING (
    shift_id = get_user_shift_id() AND
    (SELECT role FROM users WHERE id = auth.uid()) = 'Team Leader'
  );
```

#### RLS Policies for `schedules`:
```sql
CREATE POLICY "Users see own shift schedules"
  ON schedules FOR SELECT
  USING (shift_id = get_user_shift_id());

CREATE POLICY "Users insert own shift schedules"
  ON schedules FOR INSERT
  WITH CHECK (shift_id = get_user_shift_id());

-- Users can update schedules unless locked (Team Leaders can override)
CREATE POLICY "Users update own shift schedules"
  ON schedules FOR UPDATE
  USING (
    shift_id = get_user_shift_id() AND
    (locked = FALSE OR (SELECT role FROM users WHERE id = auth.uid()) = 'Team Leader')
  );

-- Team Leaders can delete schedules
CREATE POLICY "Team Leaders delete schedules"
  ON schedules FOR DELETE
  USING (
    shift_id = get_user_shift_id() AND
    (SELECT role FROM users WHERE id = auth.uid()) = 'Team Leader'
  );
```

#### RLS Policies for `task_requirements`:
```sql
CREATE POLICY "Users see own shift task requirements"
  ON task_requirements FOR SELECT
  USING (shift_id = get_user_shift_id());

CREATE POLICY "Users modify own shift task requirements"
  ON task_requirements FOR ALL
  USING (shift_id = get_user_shift_id())
  WITH CHECK (shift_id = get_user_shift_id());
```

#### RLS Policies for `scheduling_rules`:
```sql
CREATE POLICY "Users see own shift rules"
  ON scheduling_rules FOR SELECT
  USING (shift_id = get_user_shift_id());

CREATE POLICY "Users update own shift rules"
  ON scheduling_rules FOR UPDATE
  USING (shift_id = get_user_shift_id());
```

#### RLS Policies for `activity_log`:
```sql
CREATE POLICY "Users see own shift activity"
  ON activity_log FOR SELECT
  USING (shift_id = get_user_shift_id());

CREATE POLICY "Users insert own shift activity"
  ON activity_log FOR INSERT
  WITH CHECK (shift_id = get_user_shift_id());
```

---

### 2.3 Authentication Setup

#### Configure Supabase Auth:

1. **In Supabase Dashboard → Authentication → Settings**:
   - Enable Email provider
   - Disable email confirmation (for User Code pattern)
   - Set password strength requirements (min 8 chars)
   - Configure redirect URLs for your domain

2. **User Code Pattern Implementation**:
   - User codes are unique identifiers (e.g., `EMP001`, `TC-GIEDRIUS`)
   - Convert to fake email: `EMP001@lotb.local`
   - Store real email in `users.email` (optional)

3. **Trigger to create user profile**:
```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- This is called after auth.users insert
  -- We'll handle user creation via application logic instead
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: We'll handle profile creation in application code to have more control
```

---

## 📋 Phase 3: Migration Implementation

### 3.1 Create Supabase Client

**File**: `services/supabase/client.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types'; // Auto-generated

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
```

---

### 3.2 Implement Supabase Storage Service

**File**: `services/storage/supabaseStorage.ts`

Implement the existing `StorageService` interface but backed by Supabase.

**Key features**:
- All queries filtered by `shift_id` (automatic via RLS)
- Real-time subscriptions for collaborative editing
- Optimistic updates with conflict resolution
- Error handling and retry logic

**Example**: `getOperators()`

```typescript
async getOperators(): Promise<Operator[]> {
  const { data, error } = await supabase
    .from('operators')
    .select('*')
    .eq('archived', false)
    .order('name');

  if (error) throw new Error(`Failed to fetch operators: ${error.message}`);

  return data.map(mapSupabaseOperatorToApp);
}
```

---

### 3.3 Authentication Service

**File**: `services/supabase/authService.ts`

Replace current local auth with Supabase Auth.

**Key functions**:
- `signInWithUserCode(userCode: string, password: string)`
- `signInWithEmail(email: string, password: string)`
- `signUp(userCode: string, password: string, displayName: string, email?: string)`
- `signOut()`
- `getCurrentUser(): User | null`
- `subscribeToAuthChanges(callback: (user: User | null) => void)`

**User Code Pattern**:
```typescript
async signInWithUserCode(userCode: string, password: string) {
  // Convert user code to email: EMP001 -> emp001@lotb.local
  const email = `${userCode.toLowerCase()}@lotb.local`;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data.user;
}
```

---

### 3.4 Real-time Subscriptions

**File**: `services/supabase/realtime.ts`

Enable collaborative editing with real-time updates.

**Features**:
- Subscribe to schedule changes
- Subscribe to operator updates
- Subscribe to task updates
- Handle conflicts (last-write-wins or merge strategies)

**Example**: Subscribe to schedule updates

```typescript
export function subscribeToScheduleUpdates(
  weekStartDate: string,
  onUpdate: (schedule: Schedule) => void
) {
  const subscription = supabase
    .channel('schedule-changes')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'schedules',
        filter: `week_start_date=eq.${weekStartDate}`,
      },
      (payload) => {
        onUpdate(mapSupabaseScheduleToApp(payload.new));
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}
```

---

## 📋 Phase 4: Migration & Seeding

### 4.1 Create Migrations

Use Supabase MCP plugin to apply migrations:

```typescript
// Apply migration via MCP
mcp__supabase__apply_migration({
  name: "create_initial_schema",
  query: `
    -- All SQL from Phase 2.1 and 2.2
  `
});
```

**Migration files** (create in `supabase/migrations/`):
1. `20250101000001_create_initial_schema.sql`
2. `20250101000002_create_rls_policies.sql`
3. `20250101000003_seed_initial_data.sql`

---

### 4.2 Seed Initial Data

**Seed Script**: `scripts/seedSupabase.ts`

```typescript
import { supabase } from '../services/supabase/client';
import { MOCK_OPERATORS, MOCK_TASKS } from '../types';

async function seedDatabase() {
  // 1. Create shifts
  const { data: shiftA } = await supabase
    .from('shifts')
    .insert({ name: 'Shift A' })
    .select()
    .single();

  const { data: shiftB } = await supabase
    .from('shifts')
    .insert({ name: 'Shift B' })
    .select()
    .single();

  // 2. Create demo users
  // Team Leader for Shift A
  const { data: { user: teamLeader } } = await supabase.auth.signUp({
    email: 'admin@lotb.local',
    password: 'Demo1234!',
  });

  await supabase.from('users').insert({
    id: teamLeader!.id,
    user_code: 'ADMIN',
    display_name: 'Team Leader Demo',
    role: 'Team Leader',
    shift_id: shiftA!.id,
  });

  // 3. Seed operators (half to Shift A, half to Shift B)
  const operatorsShiftA = MOCK_OPERATORS.slice(0, 12).map(op => ({
    ...op,
    shift_id: shiftA!.id,
  }));

  const operatorsShiftB = MOCK_OPERATORS.slice(12).map(op => ({
    ...op,
    shift_id: shiftB!.id,
  }));

  await supabase.from('operators').insert([...operatorsShiftA, ...operatorsShiftB]);

  // 4. Seed tasks (duplicate for both shifts)
  const tasksShiftA = MOCK_TASKS.map(t => ({ ...t, shift_id: shiftA!.id }));
  const tasksShiftB = MOCK_TASKS.map(t => ({ ...t, shift_id: shiftB!.id }));

  await supabase.from('tasks').insert([...tasksShiftA, ...tasksShiftB]);

  console.log('✅ Database seeded successfully');
}

seedDatabase();
```

---

### 4.3 Data Migration Script

**Script**: `scripts/migrateFromIndexedDB.ts`

Migrate existing user data from IndexedDB to Supabase:

```typescript
import { db } from '../services/storage/database'; // Dexie
import { supabase } from '../services/supabase/client';

async function migrateData() {
  console.log('Starting migration from IndexedDB to Supabase...');

  // 1. Fetch all data from IndexedDB
  const operators = await db.operators.toArray();
  const tasks = await db.tasks.toArray();
  const schedules = await db.schedules.toArray();
  const settings = await db.settings.toCollection().first();

  // 2. Upload to Supabase (need to be authenticated first)
  // Assume user is logged in and shift_id is known

  // Upload operators
  for (const op of operators) {
    await supabase.from('operators').insert({
      name: op.name,
      type: op.type,
      skills: op.skills,
      // ... map fields
    });
  }

  // Upload tasks, schedules, etc.

  console.log('✅ Migration complete');
}
```

---

## 📋 Phase 5: UI Integration

### 5.1 Authentication UI

**Components to create**:
1. `LoginPage.tsx` - User code + password or email + password
2. `SetupPage.tsx` - First-time user setup (if invited)
3. `ProtectedRoute.tsx` - Route guard for authenticated pages
4. `AuthContext.tsx` - React context for auth state

**Login Flow**:
```
User enters code (e.g., "EMP001") + password
→ Convert to email (emp001@lotb.local)
→ supabase.auth.signInWithPassword()
→ Fetch user profile from users table
→ Store in React context
→ Redirect to Dashboard
```

---

### 5.2 Update App.tsx

**Changes**:
1. Wrap app in `AuthProvider`
2. Show `LoginPage` if not authenticated
3. Replace IndexedDB storage service with Supabase storage service
4. Add real-time subscription to schedule updates
5. Handle loading states (fetching from cloud)

**Example**:
```typescript
function App() {
  const { user, isLoading } = useAuth();
  const [storageService] = useState(() => new SupabaseStorageService());

  if (isLoading) return <LoadingScreen />;
  if (!user) return <LoginPage />;

  return (
    <div className="app">
      {/* Existing app UI */}
    </div>
  );
}
```

---

### 5.3 Role-Based UI

**Conditionally render based on role**:

```typescript
const { user } = useAuth();
const isTeamLeader = user?.role === 'Team Leader';

return (
  <>
    {/* All users */}
    <button onClick={archiveOperator}>Archive</button>

    {/* Team Leaders only */}
    {isTeamLeader && (
      <button onClick={permanentlyDeleteOperator}>Delete Permanently</button>
    )}
  </>
);
```

---

## 📋 Phase 6: Testing & Validation

### 6.1 Unit Tests
- Test RLS policies (shift isolation)
- Test authentication flows
- Test storage service methods
- Test real-time subscriptions

### 6.2 Integration Tests
- Test multi-user collaboration
- Test conflict resolution
- Test data migration from IndexedDB

### 6.3 E2E Tests (Playwright)
- Login as Team Leader
- Login as TC
- Verify shift isolation (TC cannot see other shift data)
- Create schedule and verify real-time sync
- Test permission boundaries

### 6.4 Seed Data for Testing
Create a "Reset to Demo Data" button:
- Clears current shift's data
- Reseeds with MOCK_OPERATORS and MOCK_TASKS
- Useful for Playwright tests and demos

---

## 📋 Phase 7: Production Deployment

### 7.1 Environment Setup
- Production Supabase project (separate from dev)
- Environment variables for production
- CI/CD pipeline for migrations

### 7.2 Security Hardening
- Replace SHA-256 with proper password hashing (use Supabase Auth)
- Increase password minimum to 8 characters
- Add rate limiting on login attempts
- Enable 2FA for Team Leaders (optional)

### 7.3 Performance Optimization
- Add database indexes (already in schema)
- Enable Supabase connection pooling
- Optimize real-time subscription filters
- Implement query caching where appropriate

### 7.4 Monitoring & Logging
- Set up Supabase logging alerts
- Monitor RLS policy performance
- Track authentication errors
- Set up uptime monitoring

---

## 📋 Phase 8: Advanced Features

### 8.1 Real-time Collaboration UI
- Show "User X is editing this schedule" indicator
- Show live cursor positions (optional)
- Conflict resolution UI (if two users edit same cell)

### 8.2 Offline Support
- Service worker for offline mode
- Queue mutations when offline
- Sync when back online
- Supabase has built-in support for this

### 8.3 Mobile App (Future)
- React Native with Supabase SDK
- Push notifications for schedule changes
- Mobile-optimized schedule view

---

## 🛠️ Implementation Checklist

### ✅ Preparation
- [ ] Create Supabase project
- [ ] Get credentials (URL + keys)
- [ ] Install dependencies (`@supabase/supabase-js`)
- [ ] Set up `.env` file

### ✅ Database Schema
- [ ] Create all tables (Phase 2.1)
- [ ] Enable RLS on all tables (Phase 2.2)
- [ ] Create RLS policies (Phase 2.2)
- [ ] Create helper functions (get_user_shift_id)
- [ ] Test RLS policies manually

### ✅ Authentication
- [ ] Configure Supabase Auth settings
- [ ] Implement auth service (authService.ts)
- [ ] Create LoginPage component
- [ ] Create AuthContext and provider
- [ ] Test user code login flow
- [ ] Test email login flow

### ✅ Storage Service
- [ ] Create Supabase client (client.ts)
- [ ] Implement SupabaseStorageService
- [ ] Map Supabase types to app types
- [ ] Add error handling
- [ ] Test CRUD operations

### ✅ Real-time
- [ ] Implement real-time subscriptions
- [ ] Test schedule sync between users
- [ ] Add conflict resolution logic
- [ ] Test operator updates sync

### ✅ Migration
- [ ] Create migration scripts
- [ ] Seed initial data (shifts, demo users)
- [ ] Create IndexedDB → Supabase migration tool
- [ ] Test data migration

### ✅ UI Integration
- [ ] Replace IndexedDB service with Supabase service
- [ ] Add loading states for cloud fetches
- [ ] Add role-based UI rendering
- [ ] Update App.tsx with AuthProvider
- [ ] Test full user flow

### ✅ Testing
- [ ] Write unit tests for RLS policies
- [ ] Write integration tests for storage service
- [ ] Create Playwright E2E tests
- [ ] Add "Reset to Demo Data" button

### ✅ Production
- [ ] Set up production Supabase project
- [ ] Configure environment variables
- [ ] Deploy migrations to production
- [ ] Set up monitoring and alerts
- [ ] Document deployment process

---

## 🎯 Success Metrics

1. **Shift Isolation**: TC from Shift A cannot query Shift B data (enforced by RLS)
2. **Real-time Sync**: Changes appear instantly for all users viewing same schedule
3. **Performance**: Page loads < 2 seconds, real-time updates < 500ms
4. **Security**: All data access controlled by RLS policies
5. **Migration**: Seamless migration from IndexedDB with zero data loss

---

## 📚 Resources

- [Supabase Docs](https://supabase.com/docs)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Realtime Guide](https://supabase.com/docs/guides/realtime)
- [TypeScript Support](https://supabase.com/docs/guides/api/typescript-support)
- [Local Development](https://supabase.com/docs/guides/cli/local-development)

---

**Last Updated**: December 14, 2025
**Status**: Ready for implementation

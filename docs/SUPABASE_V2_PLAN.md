# Supabase V2 Integration Plan

**Date**: December 21, 2025
**Status**: Planning Phase

## Executive Summary

This plan reintegrates Supabase with lessons learned from the previous attempt. The key improvement is a **hybrid approach**: IndexedDB for offline-first local storage + Supabase for cloud sync, collaboration, and backup.

## Why Supabase Was Previously Reverted

The previous integration had these issues:

1. **Breaking login changes**: Changed from alphanumeric user codes to numeric batch numbers only
2. **No offline support**: Required constant internet connection
3. **Data loss risk**: Clearing browser data meant losing access (not data itself)
4. **Complexity**: Full replacement of IndexedDB was too aggressive

## V2 Approach: Hybrid Architecture

### Core Principle: Offline-First with Cloud Sync

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React App     │────▶│   IndexedDB     │────▶│   Supabase      │
│   (UI Layer)    │◀────│   (Local First) │◀────│   (Cloud Sync)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                       │
         │                       │                       │
    User Actions            Immediate              Background
    feel instant           persistence            sync (async)
```

### Benefits of Hybrid Approach

1. **Works offline**: All operations use IndexedDB first
2. **Fast performance**: No network latency for UI interactions
3. **Cloud backup**: Data syncs to Supabase in background
4. **Multi-device**: Access from any device once synced
5. **Collaboration**: Real-time updates between TCs
6. **Gradual migration**: IndexedDB still works if Supabase is unavailable

---

## Implementation Phases

### Phase 1: Supabase Setup (Foundation)

**Goal**: Set up Supabase project with proper schema

#### 1.1 Create Supabase Project
- Create project at [supabase.com](https://supabase.com)
- Region: EU West (closest to users)
- Save credentials securely

#### 1.2 Database Schema

Keep the same schema from previous attempt (it was well-designed):

**Tables**:
- `shifts` - Shift definitions (A, B)
- `users` - User accounts with roles
- `operators` - Warehouse operators
- `tasks` - Task/skill definitions
- `task_requirements` - Staffing requirements per task
- `schedules` - Weekly schedules with assignments
- `scheduling_rules` - Algorithm settings per shift
- `activity_log` - Audit trail

**Key improvement**: Add `sync_status` column to track local changes:

```sql
ALTER TABLE operators ADD COLUMN sync_status TEXT DEFAULT 'synced';
-- Values: 'synced', 'pending', 'conflict'
```

#### 1.3 Row Level Security (RLS)

Same as before - shift isolation at database level:
- Users only see their shift's data
- Team Leaders have override permissions
- TCs can edit but not permanently delete

### Phase 2: Hybrid Storage Service

**Goal**: Create a storage service that uses IndexedDB first, syncs to Supabase

#### 2.1 Architecture

```typescript
// services/storage/hybridStorage.ts

export class HybridStorageService implements StorageService {
  private local: IndexedDBStorage;
  private cloud: SupabaseStorage;
  private syncQueue: SyncQueue;

  async getOperators(): Promise<Operator[]> {
    // Always read from local (instant)
    return this.local.getOperators();
  }

  async saveOperator(operator: Operator): Promise<void> {
    // 1. Save to local immediately
    await this.local.saveOperator(operator);

    // 2. Queue for cloud sync (non-blocking)
    this.syncQueue.add('operators', 'upsert', operator);
  }

  async sync(): Promise<SyncResult> {
    // Sync local changes to cloud
    // Pull cloud changes to local
    // Resolve conflicts
  }
}
```

#### 2.2 Sync Queue

```typescript
interface SyncQueueItem {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: any;
  timestamp: number;
  retryCount: number;
}
```

- Queue persisted in IndexedDB
- Background worker processes queue
- Retry with exponential backoff
- Visual indicator when offline/syncing

#### 2.3 Conflict Resolution

Simple "last-write-wins" with user notification:

```typescript
async resolveConflict(local: any, remote: any): Promise<any> {
  if (remote.updated_at > local.updated_at) {
    // Remote is newer, use remote
    showToast('Schedule was updated by another user');
    return remote;
  }
  // Local is newer, push to remote
  return local;
}
```

### Phase 3: Authentication

**Goal**: Flexible auth that supports user codes AND email

#### 3.1 Login Methods (Improved)

```typescript
// Support both patterns
async login(identifier: string, password: string): Promise<User> {
  // Detect if email or user code
  const isEmail = identifier.includes('@');

  if (isEmail) {
    return this.loginWithEmail(identifier, password);
  } else {
    // User code: convert to internal email
    // EMP001 -> emp001@lotb.local
    const email = `${identifier.toLowerCase()}@lotb.local`;
    return this.loginWithEmail(email, password);
  }
}
```

#### 3.2 Offline Login

If Supabase is unreachable, use cached credentials:

```typescript
async login(identifier: string, password: string): Promise<User> {
  try {
    // Try cloud auth first
    const user = await this.supabaseAuth(identifier, password);
    // Cache credentials locally
    await this.cacheSession(user);
    return user;
  } catch (error) {
    if (error.code === 'NETWORK_ERROR') {
      // Fall back to cached session
      return this.getCachedSession(identifier, password);
    }
    throw error;
  }
}
```

#### 3.3 Session Management

- Cloud sessions: 7 days (refreshable)
- Cached sessions: 24 hours (offline only)
- Auto-refresh when online

### Phase 4: Real-time Sync

**Goal**: Live updates when multiple TCs are editing

#### 4.1 Supabase Realtime Subscriptions

```typescript
// Subscribe to schedule changes for current week
const subscription = supabase
  .channel('schedule-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'schedules',
    filter: `week_start_date=eq.${currentWeekStart}`
  }, (payload) => {
    // Update local state
    handleRemoteScheduleChange(payload);
  })
  .subscribe();
```

#### 4.2 Presence (Who's Online)

```typescript
// Show which TCs are currently viewing the schedule
const presence = supabase
  .channel('online-users')
  .on('presence', { event: 'sync' }, () => {
    const users = presence.presenceState();
    updateOnlineUsersUI(users);
  })
  .subscribe();
```

#### 4.3 Optimistic Updates with Rollback

```typescript
async updateAssignment(day: string, operatorId: string, taskId: string) {
  // 1. Update UI immediately (optimistic)
  setAssignment(day, operatorId, taskId);

  // 2. Save to local
  await local.saveAssignment(...);

  // 3. Sync to cloud
  try {
    await cloud.saveAssignment(...);
  } catch (error) {
    // 4. Rollback if sync fails
    rollbackAssignment(day, operatorId);
    showToast('Failed to sync, please try again');
  }
}
```

### Phase 5: Migration Tools

**Goal**: Smooth transition from local-only to hybrid

#### 5.1 One-Click Export

```typescript
async exportAllData(): Promise<ExportedData> {
  const data = {
    operators: await storage.getOperators(),
    tasks: await storage.getTasks(),
    schedules: await storage.getAllSchedules(),
    settings: await storage.getSettings(),
    exportedAt: new Date().toISOString(),
    version: '1.0'
  };

  downloadAsJSON(data, 'lotb-backup.json');
  return data;
}
```

#### 5.2 Import to Supabase

```typescript
async importToCloud(data: ExportedData, shiftId: string) {
  // Validate data structure
  validateExportFormat(data);

  // Map local IDs to cloud UUIDs
  const idMapping = new Map();

  // Import in order (operators -> tasks -> schedules)
  await importOperators(data.operators, shiftId, idMapping);
  await importTasks(data.tasks, shiftId, idMapping);
  await importSchedules(data.schedules, shiftId, idMapping);

  showToast('Data imported successfully!');
}
```

#### 5.3 Settings UI

Add to Settings page:

```
Cloud Sync
─────────────────────────────────
Status: ● Connected (synced 2 min ago)

[ Export Local Data ]  [ Import to Cloud ]

──────────────────────────────────
⚠️ Enable cloud sync to:
• Access from any device
• Collaborate with other TCs
• Automatic backups
```

---

## File Structure

```
services/
├── storage/
│   ├── index.ts              # Exports current storage service
│   ├── database.ts           # IndexedDB schema (Dexie)
│   ├── indexedDBStorage.ts   # Local storage implementation
│   ├── supabaseStorage.ts    # Cloud storage implementation
│   └── hybridStorage.ts      # NEW: Combines both
├── supabase/
│   ├── client.ts             # Supabase client
│   ├── types.ts              # Generated TypeScript types
│   ├── authService.ts        # Authentication
│   └── realtimeService.ts    # NEW: Real-time subscriptions
└── sync/
    ├── syncQueue.ts          # NEW: Background sync queue
    ├── conflictResolver.ts   # NEW: Conflict resolution
    └── presenceService.ts    # NEW: Online user tracking
```

---

## UI Changes

### 1. Login Page

- Keep current design
- Add "Use Email" toggle for alternative login
- Show "Offline Mode" badge when not connected

### 2. Sidebar

- Add sync status indicator (●/○/⚠️)
- Show online users count when synced

### 3. Settings > Cloud Sync (New Section)

- Connection status
- Last sync time
- Export/Import buttons
- Enable/disable cloud sync toggle

### 4. Schedule Page

- Show "X users viewing" indicator
- Visual indicator when assignment is syncing
- Toast when another user makes changes

---

## Implementation Timeline

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | Supabase setup + schema | 2 hours |
| 2 | Hybrid storage service | 4 hours |
| 3 | Authentication | 2 hours |
| 4 | Real-time sync | 3 hours |
| 5 | Migration tools | 2 hours |
| 6 | UI integration | 3 hours |
| 7 | Testing | 2 hours |
| **Total** | | **~18 hours** |

---

## Success Criteria

1. **Offline works**: App fully functional without internet
2. **Sync works**: Changes sync within 5 seconds when online
3. **Collaboration**: Two TCs see each other's changes in real-time
4. **No data loss**: Export works, import works, conflicts resolved
5. **Performance**: No perceived slowdown from sync operations

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Sync conflicts | Last-write-wins + user notification |
| Network failures | Exponential backoff + retry queue |
| Data corruption | Export before import, version tracking |
| Supabase downtime | IndexedDB works independently |

---

## Next Steps

1. **Create Supabase project** - Get credentials
2. **Apply migrations** - Set up database schema
3. **Implement HybridStorageService** - Core functionality
4. **Add sync UI** - Status indicators and controls
5. **Test with two users** - Verify real-time sync

---

**Ready to proceed?** Let's start with Phase 1: Supabase Setup.

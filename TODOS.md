# TODOS - Lord of the Bins

## Priority Legend

- **P1** - Critical / Must have for beta
- **P2** - Important / Should have
- **P3** - Nice to have / Future enhancement

---

## Phase 2: Scheduling Algorithm + Conflict Warnings ✅

### P1 - Critical

- [x] Remove Gemini AI integration completely
- [x] Create constraint-based scheduling algorithm
  - [x] Respect skill requirements (hard constraint)
  - [x] Respect operator availability (hard constraint)
  - [x] Max consecutive days on same task (configurable)
  - [x] Fair distribution of heavy tasks (Troubleshooter, Exceptions)
  - [x] Balance workload across operators
  - [x] Prioritize Flex staff for Exceptions (toggle)
  - [x] Allow/disallow consecutive heavy shifts (toggle)
  - [x] Respect preferred stations (toggle)
- [x] Wire automation rules in Settings to algorithm
- [x] Conflict warning: Skill mismatch
- [x] Conflict warning: Availability conflict
- [x] Conflict warning: Double assignment (same operator, same day)
- [x] Conflict warning: Understaffed task

---

## Phase 3: Week Navigation + Schedule Management ✅

### P1 - Critical

- [x] Dynamic week calculation (not hardcoded)
- [x] Navigate to previous/next weeks
- [x] Schedule history (store past weeks)
- [x] Publish schedule functionality
  - [x] Change status Draft → Published
  - [x] Optional lock toggle (TC chooses)
  - [x] Locked schedules prevent edits

---

## Phase 4: Export + WhatsApp Share ✅

### P1 - Critical

- [x] Generate schedule as PNG image
- [x] Generate schedule as PDF
- [x] WhatsApp share button (opens with pre-filled image)

### P2 - Important

- [x] Excel/CSV export

---

## Phase 5: Dashboard ✅

### P1 - Critical

- [x] Real statistics (not hardcoded)
  - [x] Coverage %
  - [x] Staff count
  - [x] Open slots
  - [x] Operators on leave/sick
- [x] Activity log (track changes)

### P2 - Important

- [x] Notifications panel (pending items)

---

## Phase 6: Enhancements ✅

### P1 - Critical

- [x] Search functionality (name + skills + status + schedule)
- [x] Task requirements: multiple operators per task
- [x] Task requirements: variable by day (via Record<WeekDay, number>)
- [x] Make "New Task" button work
- [x] Skill required dropdown save in task settings
- [x] Coordinators assignable only to People/Process/Off-Process

### P2 - Important

- [x] Delete operator functionality
  - [x] Archive (soft delete) for TCs
  - [ ] Permanent delete for Admins (future)
- [x] Recurring availability patterns for operators
- [x] Remove Executive and Minimal themes (now only Modern + Midnight)

---

## Phase 7: Local Persistence (IndexedDB) ✅

### P1 - Critical

- [x] Install Dexie.js (`npm install dexie`)
- [x] Create database schema (`services/storage/database.ts`)
  - [x] `operators` table
  - [x] `tasks` table
  - [x] `schedules` table (weekly schedules)
  - [x] `settings` table (theme, scheduling rules)
  - [x] `activityLog` table
- [x] Create storage service interface (`services/storage/storageService.ts`)
  - [x] Define abstract interface (easy swap to Supabase later)
  - [x] CRUD operations for each entity type
- [x] Implement IndexedDB storage (`services/storage/indexedDBStorage.ts`)
  - [x] Operators: getAll, getById, save, update, delete
  - [x] Tasks: getAll, getById, save, update, delete
  - [x] Schedules: getAll, getByWeek, save, update, delete
  - [x] Settings: get, save
  - [x] Activity log: getAll, add, clear
- [x] First-time seeding logic
  - [x] Detect empty database on first load
  - [x] Seed with MOCK_OPERATORS and MOCK_TASKS
  - [x] Create initial empty schedule for current week
- [x] Integrate with App.tsx
  - [x] Load all data on app mount
  - [x] Auto-save operators on change
  - [x] Auto-save tasks on change
  - [x] Auto-save schedule on change
  - [x] Auto-save settings on change
- [x] Add loading state to UI (while IndexedDB loads)
- [x] Add error handling (IndexedDB not supported, quota exceeded)

### P2 - Important

- [x] Data export (JSON backup)
- [x] Data import (restore from JSON)
- [x] Clear all data option (with confirmation)
- [ ] Database versioning/migrations setup
- [ ] Compress old schedules (archive schedules older than X weeks)

### P3 - Nice to Have

- [x] Storage usage indicator in Settings
- [ ] Auto-backup reminder (prompt user to export periodically)
- [ ] Conflict detection (if same browser tab open twice)

---

## Future: Production Ready (Supabase Migration)

### P3 - Future

- [ ] Supabase database setup
- [ ] Migrate storage service to Supabase implementation
- [ ] Authentication system (login/logout)
- [ ] Role-based access (Team Leader vs TC)
- [ ] Team/Shift isolation (each shift sees own data)
- [ ] Real-time sync between users
- [ ] Automatic cloud backup

---

## Strategic Planning & Research

### Admin Dashboard (Team Leaders)

> **Goal:** Think deeply about what Team Leaders need that TCs don't have access to.

- [ ] What metrics/KPIs should admins see across ALL shifts?
- [ ] Cross-shift comparison views (Shift A vs Shift B performance)
- [ ] Workforce analytics (skill gaps, training needs, availability patterns)
- [ ] Override capabilities (unlock TC-locked schedules, approve changes)
- [ ] Audit trail / change history across all teams
- [ ] Capacity planning (headcount vs demand forecasting)
- [ ] Export/reporting features for management
- [ ] Alert system for critical issues (understaffed shifts, no-shows)

### Machine Learning Exploration

> **Goal:** Evaluate if ML adds real value or is just complexity. Be honest.

- [ ] **Potential ML use cases to evaluate:**
  - Predict operator absences (sick patterns, leave trends)
  - Optimal task-operator matching based on historical performance
  - Demand forecasting (busier days, seasonal patterns)
  - Anomaly detection (unusual schedule patterns, potential burnout)
  - Smart suggestions for skill development paths
- [ ] **Questions to answer:**
  - Do we have enough data to train useful models?
  - Would simple rules/heuristics achieve 80% of the benefit?
  - What's the cost/benefit vs. the current deterministic algorithm?
  - Privacy implications of tracking operator performance?
- [ ] **Decision:** ML yes/no and why

### User Flows & Authentication

> **Goal:** Design the complete user journey from registration to daily use.

- [ ] **User types & permissions:**
  - Admin (Team Leader) - full access, all shifts
  - TC (Team Coordinator) - own shift only
  - Operator (future?) - view own schedule, request swaps?
- [ ] **Authentication flow:**
  - Registration process (invite-only? self-register?)
  - Login (email/password? SSO? magic link?)
  - Password reset flow
  - Session management (auto-logout? remember me?)
- [ ] **Onboarding:**
  - First-time setup wizard for admins
  - TC onboarding (assign to shift, explain features)
  - Data migration from existing systems?
- [ ] **User management:**
  - Invite new users
  - Assign roles
  - Deactivate users
  - Transfer ownership

---

## Bugs / Fixes

- [ ] (Add bugs here as discovered)

---

## Completed

- [x] Project setup with Vite + React + TypeScript
- [x] Basic UI with 4 themes
- [x] Operator CRUD (add/edit)
- [x] Task display and color coding
- [x] Schedule grid view
- [x] Mobile responsive layout
- [x] **Phase 2**: Constraint-based scheduling algorithm (replaced Gemini AI)
- [x] **Phase 2**: All scheduling rules wired to Settings UI
- [x] **Phase 2**: Conflict warnings system (skill, availability, double assignment, understaffed)
- [x] **Phase 3**: Dynamic week calculation with weekUtils service
- [x] **Phase 3**: Week navigation (prev/next/today buttons)
- [x] **Phase 3**: Schedule history storage
- [x] **Phase 3**: Publish/Unpublish with optional lock toggle
- [x] **Phase 4**: Export functionality (PNG, PDF, WhatsApp share, Excel, CSV)
- [x] **Phase 5**: Real dashboard statistics and activity log
- [x] **Phase 5**: Notifications panel with pending items
- [x] **Phase 6**: Multiple operators per task with configurable requirements
- [x] **Phase 6**: New Task button, Skill dropdown save, Search with Cmd+K shortcut
- [x] **Phase 6**: Delete operator (archive/soft delete with restore)
- [x] **Phase 6**: Recurring availability patterns (preset patterns)
- [x] **Phase 6**: Simplified themes (Modern + Midnight only)
- [x] **Phase 7**: IndexedDB local persistence with Dexie.js
- [x] **Phase 7**: Storage service abstraction (Supabase-ready)
- [x] **Phase 7**: Auto-save, loading states, error handling

---

*Last updated: Dec 9, 2025*

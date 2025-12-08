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

- [ ] Excel/CSV export

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

- [ ] Notifications panel (pending items)

---

## Phase 6: Enhancements

### P1 - Critical

- [x] Search functionality (name + skills + status + schedule)
- [x] Task requirements: multiple operators per task
- [x] Task requirements: variable by day (via Record<WeekDay, number>)
- [x] Make "New Task" button work
- [x] Skill required dropdown save in task settings
- [x] Coordinators assignable only to People/Process/Off-Process

### P2 - Important

- [ ] Delete operator functionality
  - [ ] Archive (soft delete) for TCs
  - [ ] Permanent delete for Admins (future)
- [ ] Recurring availability patterns for operators
- [ ] Remove Executive and Minimal themes

---

## Future: Production Ready (Phase 1)

### P3 - Future

- [ ] Supabase database setup
- [ ] Authentication system (login/logout)
- [ ] Role-based access (Team Leader vs TC)
- [ ] Team/Shift isolation (each shift sees own data)
- [ ] Real-time sync between users
- [ ] Automatic cloud backup

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
- [x] **Phase 4**: Export functionality (PNG, PDF, WhatsApp share)
- [x] **Phase 5**: Real dashboard statistics and activity log
- [x] **Phase 6**: Multiple operators per task with configurable requirements
- [x] **Phase 6**: New Task button, Skill dropdown save, Search with Cmd+K shortcut

---

*Last updated: Dec 8, 2025*

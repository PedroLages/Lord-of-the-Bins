# Lord of the Bins - Requirements Document

## Users & Access

| Role | Access | Capabilities |
|------|--------|--------------|
| Team Leader | Own shift only | Everything TC can do + permanent deletes + override TCs + user management |
| Team Coordinator (TC) | Own shift only | Schedule, archive operators, create tasks/skills |
| Operators | None | Receive schedule via WhatsApp |

> **Note:** Each shift has its own Team Leader. Team Leaders do NOT have cross-shift access.

## Shifts Structure

- 2 separate teams (no operator overlap)
- 1 Team Leader per shift
- 3 TCs per shift
- Each shift sees only their own data (team-based isolation)

## Authentication

### Login Methods

| Method | Primary/Secondary | Notes |
|--------|-------------------|-------|
| User Code + Password | Primary | Employee ID (e.g., "EMP001") - no email required |
| Email + Password | Secondary | Alternative for users who prefer email |
| Magic Link | Fallback | Password reset / alternative login |

### User Code Pattern

- Each user has a unique code (e.g., `EMP001`, `TC-GIEDRIUS`)
- Codes are shorter and faster to type than emails
- Email is optional (only needed for password reset)

### Registration Flow

1. Team Leader sends invite via dashboard
2. User clicks invite link
3. User sets password + basic profile
4. Account created with pre-assigned role/shift

## Permission Matrix

### Schedule Management

| Action | TC | Team Leader |
|--------|:--:|:-----------:|
| View schedule | ✅ | ✅ |
| Create/edit draft schedule | ✅ | ✅ |
| Generate auto-schedule | ✅ | ✅ |
| Publish schedule | ✅ | ✅ |
| Lock/unlock own published schedule | ✅ | ✅ |
| **Unlock ANY locked schedule** | ❌ | ✅ |
| **Delete schedule history** | ❌ | ✅ |

### Operator Management

| Action | TC | Team Leader |
|--------|:--:|:-----------:|
| View operators | ✅ | ✅ |
| Add new operator | ✅ | ✅ |
| Edit operator details/skills/availability | ✅ | ✅ |
| Archive operator (soft delete) | ✅ | ✅ |
| Restore archived operator | ✅ | ✅ |
| **Permanent delete operator** | ❌ | ✅ |
| **Reassign operator to different shift** | ❌ | ✅ |

### Task Management

| Action | TC | Team Leader |
|--------|:--:|:-----------:|
| View tasks | ✅ | ✅ |
| Create/edit/archive task | ✅ | ✅ |
| **Permanent delete task** | ❌ | ✅ |

### Settings & Configuration

| Action | TC | Team Leader |
|--------|:--:|:-----------:|
| Change own theme | ✅ | ✅ |
| Edit scheduling rules | ✅ | ✅ |
| Export data (JSON/Excel) | ✅ | ✅ |
| **Lock scheduling rules** | ❌ | ✅ |
| **Import data** | ❌ | ✅ |
| **Clear all data** | ❌ | ✅ |

### User Management

| Action | TC | Team Leader |
|--------|:--:|:-----------:|
| View team members | ✅ | ✅ |
| Change own password/profile | ✅ | ✅ |
| **Invite new TC** | ❌ | ✅ |
| **Deactivate TC account** | ❌ | ✅ |
| **Reset TC password** | ❌ | ✅ |

### Audit & Activity

| Action | TC | Team Leader |
|--------|:--:|:-----------:|
| View activity log | ✅ | ✅ |
| **View full audit trail** | ❌ | ✅ |
| **Export audit reports** | ❌ | ✅ |

## Future: API Integrations

Potential integration with BOL/CEVA systems:

| Data Source | Integration Type | Purpose |
|-------------|------------------|---------|
| Employee Master Data | Import | Auto-sync operator names, codes, shifts |
| Leave/Sick Systems | Import | Pre-populate unavailability |
| Training Records | Import | Certified skills list |
| HR Assignments | Import | Shift A/B membership |

## Core Features

| Feature | Details |
|---------|---------|
| Database | Supabase (shared data, real-time sync) |
| Authentication | Login system with roles (Admin/TC) |
| Week Navigation | Browse past/future weeks |
| Schedule History | Keep records for reference/reporting |
| Publish Schedule | Visual status + optional lock (TC chooses) |
| WhatsApp Share | Share schedule as PNG image |
| Scheduling Algorithm | No AI - deterministic constraint-based algorithm |

## Scheduling Algorithm Rules

1. **Strict Skill Matching** (on/off) - Only assign if operator has required skill
2. **Allow consecutive Heavy shifts** (on/off) - Heavy tasks: Troubleshooter, Exceptions
3. **Prioritize Flex staff for Exceptions** (on/off)
4. **Respect Preferred Stations** (on/off)
5. **Max consecutive days on same task** (configurable number)
6. **Fair distribution** - Spread heavy tasks evenly across team
7. **Balance workload** - Similar shift count per operator per week

## Task Requirements

- Multiple operators can be assigned to same task
- Requirements variable by day (e.g., Mon: 3 Decanting, Fri: 1 Decanting)
- TCs can create new tasks
- Team Leaders can override/delete tasks

## Operator Business Rules

- **Add/Edit**: All TCs
- **Archive**: TCs (soft delete)
- **Permanent Delete**: Team Leaders only
- **Recurring availability**: Permanent patterns (e.g., "Never works Fridays")
- **Coordinators**: Can only be assigned to People, Process, Off-Process tasks

## Skill Management

- TCs can add/remove skills
- Team Leaders can override

## Conflict Warnings

- Skill mismatch (assigning without required skill)
- Availability conflict (assigning on unavailable day)
- Double assignment (same operator, two tasks, same day)
- Understaffed task (needs 3 people, only 2 assigned)

## Search Functionality

Search by:
- Operator name
- Skills
- Status (Active/Sick/Leave)
- Schedule (who is working which day)

## Export Options

- PDF download
- PNG download (also for WhatsApp share)
- Excel/CSV export

## Dashboard

- Real statistics (coverage %, staff count, open slots)
- Activity log (who changed what, when)
- Notifications (pending items needing TC attention)

## UI/UX

- **Themes**: Modern (light) + Midnight (dark) only
- **Days**: Monday - Friday only
- **Language**: English only
- **Real-time**: Instant sync between TCs (Supabase real-time)
- **Responsive**: Works on desktop and mobile

## To Remove from Current App

- Gemini AI integration
- Slack integration (fake)
- Workday integration (fake)
- Executive theme
- Minimal theme

## Priority Pain Points to Solve

1. **Time consuming** → Auto-schedule algorithm
2. **Errors/conflicts** → Conflict warnings system

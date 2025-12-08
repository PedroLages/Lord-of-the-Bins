# Lord of the Bins - Requirements Document

## Users & Access

| Role | Access | Capabilities |
|------|--------|--------------|
| Team Leader (Admin) | Full | Everything + permanent delete + override TCs |
| Team Coordinator (TC) | Their shift only | Schedule, archive operators, create tasks/skills |
| Operators | None | Receive schedule via WhatsApp |

## Shifts Structure

- 2 separate teams (no operator overlap)
- 3 TCs per shift
- Each shift sees only their own data (team-based isolation)

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

## Operator Management

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

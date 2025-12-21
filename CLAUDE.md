# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Repository:** <https://github.com/PedroLages/Lord-of-the-Bins>

## Project Documentation

### Root Documentation

- **README.md** - Project overview, quick start, architecture, and tech stack
- **REQUIREMENTS.md** - Full requirements and feature specifications
- **TODOS.md** - Task list organized by priority (P1, P2, P3). Add new todos here when requested.

### Organized Documentation (docs/)

**docs/algorithms/** - Algorithm research and analysis

- ALGORITHM_COMPARISON_REPORT.md - V1 vs V2 vs V3 vs V4 algorithm comparison
- ALGORITHM_ENHANCEMENT_COMPLETE.md - V4 enhancement completion report
- ALGORITHM_FIX_PLAN.md - Algorithm fix planning document
- ALGORITHM_QUICK_SUMMARY.md - Quick reference for algorithm features
- ALGORITHM_TEST_REPORT.md - Algorithm testing methodology
- ALGORITHM_TEST_RESULTS.md - Test results for various algorithm versions
- ALGORITHM_V3_TEST_RESULTS.md - V3-specific test results
- CP_SAT_ANALYSIS.md - Constraint Programming SAT solver analysis
- SCHEDULING_ALGORITHM_ANALYSIS.md - Detailed scheduling algorithm analysis
- SCHEDULING_V2_PLAN.md - V2 algorithm planning document

**docs/test-reports/** - Testing documentation

- AUTHENTICATION_TEST_REPORT.md - Authentication system testing
- COMPREHENSIVE_TEST_RESULTS.md - End-to-end test results
- E2E_ALGORITHM_TEST_RESULTS.md - Algorithm E2E test results
- TEST_REPORT_FILL_GAPS.md - Fill gaps feature testing
- TEST_REPORT_PLANNING_MODAL.md - Planning modal testing

**docs/ux-research/** - User experience research

- PLANNING_MODAL_UX_RESEARCH.md - Planning modal UX analysis
- SETTINGS_PAGE_UX_RESEARCH.md - Settings page UX research
- SETTINGS_UX_ANALYSIS.md - General settings UX analysis
- SIDEBAR_UX_RESEARCH.md - Sidebar navigation research
- TASK_REQUIREMENTS_UX_ANALYSIS.md - Task requirements UI research
- UX_WEEKLY_ASSIGNMENT_RECOMMENDATION.md - Weekly assignment UX recommendations

**docs/planning/** - Project planning documents

- COLOR_THEMES_EXPLORATION.md - Color theme design exploration
- ENHANCED_MULTI_OBJECTIVE_PLAN.md - Multi-objective optimization planning
- FINAL_SUMMARY.md - Project milestone summary
- IMPLEMENTATION_PLAN.md - Feature implementation plans
- SESSION_SUMMARY.md - Development session summaries

**docs/project/** - Project setup and migration

- SETUP_SUMMARY.md - Project setup guide

**docs/archive/** - Deprecated documentation

- SUPABASE_INTEGRATION_PLAN.md - (Archived) Supabase integration plan
- SUPABASE_SETUP_GUIDE.md - (Archived) Supabase setup instructions
- SUPABASE_STATUS.md - (Archived) Supabase integration status

**docs/** - Core guides

- AUTH_MIGRATION_GUIDE.md - Migration from Supabase to local auth
- PRE_MERGE_VERIFICATION.md - Pre-merge verification checklist
- SUPABASE_V2_PLAN.md - Supabase V2 hybrid architecture plan

**supabase/** - Supabase configuration and migrations

- README.md - Supabase setup guide
- migrations/001_create_schema.sql - Database schema
- migrations/002_create_rls_policies.sql - Row Level Security policies

## Project Overview

Lord of the Bins is a weekly operational planning tool for warehouse teams. It manages operators, skills, and generates optimized schedules using a **deterministic constraint-based algorithm** (no AI dependency).

### Target Users

- **Team Leaders (Admin)** - Full access, can override TCs
- **Team Coordinators (TC)** - Manage their shift's schedules and operators
- 2 shifts with 3 TCs each, completely separate teams

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server on port 3000
npm run build        # Build for production
npm run preview      # Preview production build
```

## Git Workflow

**IMPORTANT:** All feature development MUST use git branches and pull requests. Never commit directly to `main`.

### Workflow for New Features

1. **Create a feature branch** from `main`:

   ```bash
   git checkout main
   git pull
   git checkout -b feature/your-feature-name
   # or: chore/..., fix/..., docs/...
   ```

2. **Develop and commit** your changes:

   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

3. **Push to remote** and create a PR:

   ```bash
   git push -u origin feature/your-feature-name
   gh pr create --title "Add feature X" --body "Description..."
   ```

4. **CI/CD checks** will run automatically:
   - ✅ **CI** - TypeScript type check and build verification
   - ✅ **Claude Code Review** - AI-powered code quality review (optional)
   - ✅ **Security Review** - Automated security scanning (optional)

5. **Merge** only after all checks pass:

   ```bash
   gh pr merge <PR-number> --squash
   ```

### Branch Naming Convention

- `feature/` - New features (e.g., `feature/add-dark-mode`)
- `fix/` - Bug fixes (e.g., `fix/schedule-validation`)
- `chore/` - Maintenance tasks (e.g., `chore/update-dependencies`)
- `docs/` - Documentation updates (e.g., `docs/update-readme`)

### Commit Message Format

Follow conventional commits:

```text
<type>: <description>

[optional body]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `perf`

## Architecture

### Tech Stack

- React 19 + TypeScript + Vite
- Tailwind CSS (loaded via CDN in index.html)
- lucide-react for icons
- **No AI/Gemini** - Uses deterministic scheduling algorithm

### Application Structure

**App.tsx** - Main component containing:

- All application state (operators, tasks, schedule, UI state)
- Four main views: Dashboard, Schedule, Team, Settings
- Theme system: Modern (light) + Midnight (dark)
- `THEME_STYLES` object defines per-theme Tailwind classes

**types.ts** - Core domain types:

- `Operator`: team members with skills, availability, type (Regular/Flex/Coordinator)
- `TaskType`: warehouse tasks with required skills and color coding
- `WeeklySchedule`/`DailySchedule`: schedule data structures
- Contains `MOCK_OPERATORS` and `MOCK_TASKS` seed data

**services/** - Business logic:

- `schedulingService.ts` - Constraint-based scheduling algorithm
  - `generateSmartSchedule()` - Scores operator-task combinations and assigns optimally
  - `validateSchedule()` - Returns warnings for conflicts (skill mismatch, availability, double assignment, understaffed)
  - `SchedulingRules` interface - All toggleable rules
  - `DEFAULT_RULES` - Default configuration

- `weekUtils.ts` - Week calculation and navigation utilities
  - `createEmptyWeek()` - Creates a new week schedule from a date
  - `getAdjacentWeek()` - Gets prev/next week for navigation
  - `getWeekLabel()` / `getWeekRangeString()` - Display formatting
  - `isCurrentWeek()` - Check if viewing current week

**services/supabase/** - Cloud sync (optional):

- `client.ts` - Supabase client singleton
- `types.ts` - Database TypeScript types
- `authService.ts` - Authentication (user codes + email)
- `supabaseStorage.ts` - Cloud storage implementation
- `realtimeService.ts` - Real-time subscriptions

**services/sync/** - Sync queue and data export:

- `syncQueue.ts` - Background sync queue for offline-first
- `dataExport.ts` - Export/import data as JSON

**services/storage/** - Data persistence:

- `hybridStorage.ts` - Combines IndexedDB + Supabase sync

**components/** - UI components:

- `Sidebar.tsx` - Navigation with theme-aware styling
- `OperatorModal.tsx` - Add/edit operator form with skill selection

### Scheduling Algorithm Rules

1. Strict Skill Matching (on/off)
2. Allow consecutive Heavy shifts - Troubleshooter, Exceptions (on/off)
3. Prioritize Flex staff for Exceptions (on/off)
4. Respect Preferred Stations (on/off)
5. Max consecutive days on same task (configurable)
6. Fair distribution of heavy tasks
7. Balance workload per operator

### State Management

All state lives in App.tsx using React hooks. No external state management. Schedule assignments are keyed by `operatorId` in each day's `assignments` map.

### Styling Pattern

Tailwind classes are applied conditionally based on the active theme. The `styles` object (derived from `THEME_STYLES[theme]`) provides consistent theme-aware class names throughout components.

## Key Business Rules

- Operators can only be assigned tasks they have skills for
- Coordinators can only be assigned: People, Process, Off-Process
- Schedules are Mon-Fri only
- Multiple operators can be assigned to the same task (variable by day)
- Published schedules can optionally be locked from editing

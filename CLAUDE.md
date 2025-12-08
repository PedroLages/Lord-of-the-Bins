# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Repository:** <https://github.com/PedroLages/Lord-of-the-Bins>

## Project Documentation

- **REQUIREMENTS.md** - Full requirements and feature specifications
- **TODOS.md** - Task list organized by priority (P1, P2, P3). Add new todos here when requested.

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

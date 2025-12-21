# Lord of the Bins

<div align="center">

**One Schedule to Rule Them All**

A modern warehouse scheduling tool for decanting department teams.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white)

</div>

---

## 📦 Overview

Lord of the Bins is a production-ready scheduling application designed for warehouse operations teams. It helps Team Leaders and Coordinators manage operators, assign tasks, and optimize weekly schedules while respecting complex operational constraints.

### Key Features

- **🗓️ Smart Scheduling**: V4 Max Matching algorithm with 100% fulfillment guarantee
- **👥 Operator Management**: Skills-based assignment with availability tracking
- **📊 Plan Builder**: Create weekly staffing plans with drag-and-drop interface
- **⚖️ Constraint Handling**: Respect Heavy task limits, consecutive day caps, and fairness rules
- **🎨 Dual Themes**: Modern (light) and Midnight (dark) themes
- **💾 Local Storage**: IndexedDB-based persistence (no server required)
- **🔐 Role-Based Access**: Team Leader (Admin) and Team Coordinator (TC) roles
- **📱 Export/Import**: Download schedules as JSON or Excel for sharing

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v16 or higher)
- **npm** or **yarn**

### Installation

```bash
# Clone the repository
git clone https://github.com/PedroLages/Lord-of-the-Bins.git
cd Lord-of-the-Bins

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will open at [http://localhost:3000](http://localhost:3000)

### Build for Production

```bash
npm run build
npm run preview
```

---

## 📖 Documentation

- **[CLAUDE.md](CLAUDE.md)** - Development guidelines and project structure
- **[docs/AUTH_MIGRATION_GUIDE.md](docs/AUTH_MIGRATION_GUIDE.md)** - Authentication system migration notes
- See `.claude/context/` for design principles and style guide

---

## 🏗️ Project Structure

```
Lord-of-the-Bins/
├── components/          # React components (Sidebar, Modals, etc.)
├── services/
│   ├── schedulingService.ts       # Core scheduling logic
│   ├── scheduling/
│   │   └── maxMatchingScheduler.ts # V4 Max Matching algorithm
│   ├── storage/                   # IndexedDB persistence
│   └── authService.ts             # Local authentication
├── types.ts            # TypeScript type definitions
├── App.tsx             # Main application component
└── index.tsx           # Entry point
```

---

## 🎯 Core Concepts

### Users & Roles

| Role | Permissions |
|------|-------------|
| **Team Leader** | Full access, manage all operators, override TCs, delete historical data |
| **Team Coordinator (TC)** | Manage shift schedule, add/edit operators, create tasks |

### Scheduling Algorithm

Lord of the Bins uses the **V4 Max Matching** algorithm:

1. **Phase 1**: Maximum Bipartite Matching (Hopcroft-Karp) - guarantees 100% fulfillment when mathematically possible
2. **Phase 2**: Local Search Optimization - respects soft constraints (fairness, variety, preferences)

### Task Assignment Rules

- ✅ Strict skill matching (operators must have required skill)
- ✅ Respect operator availability (time off, training)
- ✅ Coordinator constraints (TCs only: People, Process, Off-Process)
- ✅ Heavy task limits (prevent consecutive heavy shifts)
- ✅ Fair distribution (balance workload across team)
- ✅ Skill variety optimization

---

## 🎨 Theming

Two built-in themes:

- **Modern** (Light): Clean, professional for day shift
- **Midnight** (Dark): Reduced eye strain for all-day use

Toggle theme via Settings → Profile

---

## 🗂️ Data Management

### Storage

All data stored locally in **IndexedDB**:
- Operators and skills
- Tasks and task requirements
- Weekly schedules (current + history)
- Settings and appearance preferences

### Export/Import

Export full app state as JSON:
```
Settings → Export → Download Backup
```

Import to restore or migrate:
```
Settings → Import → Choose JSON file
```

---

## 🧪 Testing

Run the stress test for the Max Matching algorithm:

```bash
# Run stress test (200 iterations)
npx ts-node tests/max-matching-stress-test.ts
```

---

## 🛠️ Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling (loaded via CDN)
- **Lucide React** - Icon library
- **IndexedDB** - Client-side persistence

---

## 🔧 Development

### Code Guidelines

- Follow the **Pragmatic Quality** framework (see CLAUDE.md)
- Prefer editing existing files over creating new ones
- Avoid over-engineering - ship simple solutions fast
- Use descriptive variable names
- Comment only complex logic

### Common Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run preview      # Preview production build
```

---

## 📝 License

This project is intended for internal warehouse operations use.

---

## 🤝 Contributing

For bugs or feature requests, please contact the development team.

---

## 🏆 Acknowledgments

Developed for warehouse decanting teams to optimize shift planning and operator assignments.

*"Where chaos meets order, and every pallet finds its destiny."*

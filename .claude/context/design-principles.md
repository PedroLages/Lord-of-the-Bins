# Design Principles - Lord of the Bins

## Brand Identity

**Lord of the Bins** is a warehouse scheduling tool for decanting department teams. The brand balances professionalism with playful warehouse personality.

### Tone
- **Professional yet approachable** - This is a work tool, but shouldn't feel corporate
- **Playful warehouse humor** - "One schedule to rule them all", bin/package metaphors
- **Confident and clear** - Users need to trust the scheduling decisions

### Visual Metaphors
- Boxes, packages, bins (lucide-react: `Box`, `Package`, `Boxes`)
- Warehouse operations and logistics
- Lord of the Rings subtle references (realm, journey, destiny)

---

## Core Design Principles

### 1. Clarity Over Decoration
Every visual element must serve a purpose. Decorative elements should reinforce brand identity without cluttering the interface. Users are making scheduling decisions - they need clear information hierarchy.

### 2. Consistency Creates Trust
- Same patterns for same actions across the app
- Predictable navigation and interaction patterns
- Consistent use of color to convey meaning (success, warning, error)

### 3. Information Density Done Right
Warehouse teams need to see lots of data (operators, schedules, assignments). Design for scanability:
- Clear visual hierarchy
- Strategic use of whitespace
- Color coding for quick recognition

### 4. Accessible by Default
- WCAG 2.1 AA compliance minimum
- Keyboard navigable
- Sufficient color contrast
- Clear focus states
- Screen reader compatible

### 5. Performance is a Feature
- Perceived performance matters (loading states, optimistic updates)
- Minimize layout shift
- Smooth transitions (but not slow)

---

## User Roles & Permissions

### Team Leader (Admin)
- Full access to all features
- Can override TC decisions
- Gold/amber visual distinction
- Icon: `Crown`

### Team Coordinator (TC)
- Manages their shift's schedules
- Limited to their team's operators
- Emerald/green visual distinction
- Icon: `Shield`

---

## Key User Flows

### Authentication
1. First-run → Setup wizard (create first user)
2. Returning user → Login page
3. Session persists for 24 hours

### Core Workflow
1. Dashboard → Overview of current week
2. Schedule → View/edit weekly roster
3. Team → Manage operators and skills
4. Settings → Configuration and preferences

---

## Emotional Design Goals

- **Onboarding**: Welcoming, not overwhelming. Guide users through setup.
- **Daily Use**: Efficient, scannable, minimal friction.
- **Error States**: Helpful, not frustrating. Clear path to resolution.
- **Success States**: Subtle celebration. Confirm actions without interrupting flow.

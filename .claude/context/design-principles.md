# Lord of the Bins - Design Principles

## Core Design Philosophy

### 1. Operational Excellence First
- **Fast, Decisive Actions:** Team coordinators need to make quick decisions during live operations
- **Zero Ambiguity:** Every UI element should have a single, clear purpose
- **Error Prevention:** Design should prevent mistakes before they happen (not just catch them)
- **Confidence Through Clarity:** Users should always know the state of the system and their schedules

### 2. Warehouse-Inspired Aesthetics
- **Industrial Elegance:** Clean, professional, but with warehouse character
- **Playful Professionalism:** Serious tool, but not corporate boring
- **Visual Metaphors:** Use logistics/warehouse imagery (bins, pallets, packages) where appropriate
- **"One Schedule to Rule Them All":** Epic, powerful feeling for a critical operations tool

### 3. Speed & Performance
- **Instant Feedback:** Every interaction should feel immediate
- **No Loading States:** Pre-load data, use optimistic updates
- **Smooth Animations:** Transitions should enhance, not slow down
- **6-Day Development Cycles:** Design for rapid iteration and deployment

### 4. Two-Theme System
- **Modern (Light):** Clean, professional for day shift operations
- **Midnight (Dark):** Reduced eye strain for all-day use and night operations
- **Seamless Switching:** Instant theme toggle with no jarring changes
- **Theme-Aware Components:** All components must look good in both themes

## Domain-Specific Design Patterns

### Scheduling Interface
- **Weekly Grid View:** Primary interface for schedule management
- **Day-by-Day Navigation:** Easy to move between days and weeks
- **Drag-and-Drop:** Intuitive assignment of operators to tasks
- **Color-Coded Tasks:** Immediate visual identification of task types
- **Operator Availability:** Clear visual indicators for time off, training, etc.

### User Roles & Permissions
- **Team Leader (Admin):** Full control, can override all decisions
- **Team Coordinator (TC):** Manage their shift's schedule and operators
- **Shift Isolation:** Complete separation between shift teams (A/B/C)
- **Visual Hierarchy:** Role-based UI elements should be obvious

### Operator Management
- **Skills-Based:** Every operator has specific warehouse skills
- **Type-Aware:** Regular, Flex, and Coordinator operators have different capabilities
- **Quick Actions:** Add, edit, remove operators without leaving context
- **Profile Pictures:** Human touch for team member identification

### Task Assignment Rules
- **Skill Matching:** Can't assign tasks requiring skills the operator doesn't have
- **Coordinator Constraints:** TCs can only do People, Process, Off-Process tasks
- **Fair Distribution:** Algorithm balances heavy tasks across team
- **Consecutive Day Limits:** Prevent operator burnout on same task

## Visual Design System

### Color Strategy
```
Primary Brand: Indigo (#4f46e5, #6366f1)
- Used for: Primary actions, active states, branding
- Meaning: Trust, reliability, authority

Background:
- Modern: Slate-50 (#f8fafc) - Clean, professional
- Midnight: Slate-900 (#0f172a) - Deep, focused

Accent Colors:
- Success/Available: Emerald-500 (#10b981)
- Warning/Caution: Amber-500 (#f59e0b)
- Error/Unavailable: Red-500 (#ef4444)
- Info/Training: Blue-500 (#3b82f6)

Task Colors:
- Variable based on active color palette
- TC Tasks: Fixed colors (Light Green, Light Gray) for instant recognition
- Non-TC Tasks: Assigned from current theme palette
```

### Typography Hierarchy
```
Font Family: System default (optimized for each platform)
- Ensures fast loading and native feel

Headings:
- H1: 2rem (32px), Bold - Page titles
- H2: 1.5rem (24px), SemiBold - Section headers
- H3: 1.25rem (20px), SemiBold - Subsections

Body Text:
- Large: 1rem (16px), Regular - Primary content
- Medium: 0.875rem (14px), Regular - Secondary content
- Small: 0.75rem (12px), Regular - Captions, labels

Monospace:
- Used for: Batch numbers, operator codes, time stamps
- Conveys: Technical, precise information
```

### Spacing & Layout
```
Base Unit: 4px (Tailwind default)

Common Spacings:
- Tight: 4px (gap-1)
- Default: 8px (gap-2)
- Comfortable: 16px (gap-4)
- Generous: 24px (gap-6)
- Spacious: 32px (gap-8)

Layout Patterns:
- Sidebar: Fixed 240px (collapsed: 64px)
- Main Content: Fluid, max-width based on content
- Grid Cells: Consistent sizing for schedule grid
```

### Component Patterns

#### Buttons
- **Primary:** Indigo background, white text, bold (main actions)
- **Secondary:** Transparent background, indigo text, border (alternative actions)
- **Destructive:** Red background, white text (delete, remove actions)
- **Ghost:** Transparent, subtle hover (tertiary actions)
- **Icon-only:** For compact interfaces, always with tooltip

#### Cards
- **Rounded Corners:** `rounded-lg` (8px) for most cards
- **Borders:** Subtle, theme-aware (slate-200 light, slate-700 dark)
- **Shadows:** Minimal, only for elevation (modals, dropdowns)
- **Hover States:** Slight border color change, no dramatic effects

#### Forms & Inputs
- **Clear Labels:** Always visible, not as placeholders
- **Visual Feedback:** Border color changes on focus
- **Error States:** Red border + error message below
- **Success States:** Green border/checkmark for confirmation
- **Disabled State:** Reduced opacity + cursor not-allowed

#### Schedule Grid
- **Cell Size:** Minimum 48px tall for touch targets
- **Grid Lines:** Subtle borders for day/task separation
- **Assignment Pills:** Rounded, colored by task, with operator name
- **Empty State:** Dashed border, "Click to assign" hint
- **Drag Preview:** Semi-transparent clone follows cursor

#### Modals
- **Backdrop:** Dark overlay (60% opacity)
- **Card:** White/Slate-800, centered, `rounded-xl`
- **Max Width:** 600px for forms, 800px for complex data
- **Close Button:** Top-right, keyboard accessible (Esc)
- **Focus Trap:** Tab cycles through modal elements only

## Interaction Patterns

### Keyboard Shortcuts
- **Global:**
  - `Cmd/Ctrl + K` - Command palette
  - `Esc` - Close modals, cancel actions
  - `Tab` - Navigate form fields

- **Schedule View:**
  - Arrow keys - Navigate grid cells
  - `Enter` - Edit selected assignment
  - `Delete/Backspace` - Remove assignment

### Drag & Drop
- **Visual Feedback:** Item follows cursor with 50% opacity
- **Drop Zones:** Highlight valid targets
- **Invalid Drops:** Red border flash, bounce back animation
- **Success:** Smooth settle into position

### Loading States
- **Inline Spinners:** For small actions (save, delete)
- **Skeleton Screens:** For initial page loads
- **Progress Bars:** For multi-step operations (importing data)
- **Optimistic Updates:** Show change immediately, revert on error

### Toast Notifications
- **Success:** Green background, checkmark icon, 3s auto-dismiss
- **Error:** Red background, alert icon, 5s auto-dismiss or manual close
- **Info:** Blue background, info icon, 4s auto-dismiss
- **Position:** Bottom-right, stack multiple toasts

## Accessibility Requirements

### WCAG 2.1 Level AA Compliance
- **Color Contrast:** Minimum 4.5:1 for body text, 3:1 for large text
- **Keyboard Navigation:** All interactive elements keyboard accessible
- **Screen Readers:** Semantic HTML, ARIA labels where needed
- **Focus Indicators:** Visible focus rings on all interactive elements
- **Touch Targets:** Minimum 44x44px for mobile/touch interfaces

### Semantic HTML
- Use proper heading hierarchy (H1 → H2 → H3)
- `<button>` for actions, `<a>` for navigation
- `<form>` elements for data input
- Proper `<table>` structure for tabular data (schedule grid)

### Responsive Design
- **Desktop First:** Primary use case is desktop operations
- **Tablet Support:** Functional for on-floor coordinators
- **Mobile View:** Read-only schedule viewing (no editing on mobile)

## Animation Principles

### Performance
- Use `transform` and `opacity` for animations (GPU-accelerated)
- Avoid animating `width`, `height`, `top`, `left` (causes reflow)
- `transition-duration`: 150-300ms for most interactions
- `ease-in-out` or `ease-out` for natural feeling

### When to Animate
- ✅ Modal open/close - Scale + fade
- ✅ Dropdown menus - Slide down
- ✅ Toast notifications - Slide in from side
- ✅ Hover states - Subtle color shift
- ✅ Drag & drop - Smooth position changes
- ❌ Page transitions - Keep it instant
- ❌ Form validation - Immediate, no delay

## Error Handling & Edge Cases

### Empty States
- **No Operators:** Clear call-to-action to add first operator
- **No Schedules:** Guide user to create first week
- **No Assignments:** Show "Click to assign" hints in grid
- **Search No Results:** Suggest clearing filters or different search

### Error Messages
- **Be Specific:** "Operator already assigned to Quality Checker on Monday" not "Assignment failed"
- **Suggest Solutions:** "Remove existing assignment first" or "Choose different day"
- **Friendly Tone:** Professional but not robotic
- **Technical Details:** Console logs for developers, not in UI

### Validation
- **Client-side First:** Catch errors before server round-trip
- **Real-time Feedback:** Validate on blur, not just on submit
- **Positive Reinforcement:** Show success states, not just errors

## Content & Copy Guidelines

### Tone of Voice
- **Professional:** This is a production operations tool
- **Confident:** "Schedule generated successfully" not "We think this might work"
- **Clear:** "Delete operator?" not "Are you sure you want to proceed?"
- **Warehouse Context:** Use domain language (operators, shifts, tasks, bins)

### Microcopy Examples
- Buttons: "Generate Schedule", "Assign Operator", "Save Changes"
- Empty states: "No operators yet", "Schedule is empty", "No violations found"
- Success: "Schedule published", "Operator added", "Settings saved"
- Errors: "Cannot assign - missing required skill", "Operator unavailable on this day"

### Help Text
- Keep it brief and contextual
- Use tooltips for additional information
- Link to documentation for complex features
- "Learn more →" for deeper dives

## Quality Checklist for Design Reviews

Before shipping any UI change, verify:

- [ ] Works in both Modern and Midnight themes
- [ ] Keyboard accessible (test with Tab, Enter, Esc)
- [ ] Color contrast meets WCAG AA standards
- [ ] Touch targets are at least 44x44px
- [ ] Loading states are handled gracefully
- [ ] Error states provide actionable feedback
- [ ] Empty states guide users to next action
- [ ] Tooltips on icon-only buttons
- [ ] Animations are performant (60fps)
- [ ] Copy is clear and warehouse-domain appropriate
- [ ] Works for all user roles (Team Leader, TC, view-only)
- [ ] Mobile view is at least readable (if not fully functional)

## Design Debt & Technical Constraints

### Accept These Trade-offs
- **Rapid Iteration > Pixel Perfection:** Ship fast, iterate based on real usage
- **Functional > Beautiful:** If it works well, minor visual issues are acceptable
- **Desktop-First:** Mobile is nice-to-have, not primary target
- **IndexedDB Limitations:** Browser storage limits (~50MB), acceptable for this use case

### Never Compromise On
- **Data Integrity:** Schedules must be accurate and conflict-free
- **Performance:** UI must feel instant (<100ms for most actions)
- **Accessibility:** Must be usable by all team members
- **Role-Based Security:** TCs can't edit other shifts, ever

---

**Remember:** Lord of the Bins is a tool for real warehouse teams managing real operations. Every design decision should optimize for speed, clarity, and operational confidence.

# Style Guide - Lord of the Bins

## Theme System

The app supports two themes: **Modern** (light) and **Midnight** (dark).

### Midnight Theme (Primary)
The dark theme used for authentication pages and preferred for low-light environments.

```
Background:       #0f172a (slate-950-ish)
Card Background:  bg-slate-900
Card Border:      border-slate-800
Text Primary:     text-white / text-slate-200
Text Secondary:   text-slate-400
Text Muted:       text-slate-500 / text-slate-600
Accent:           indigo (indigo-400, indigo-500, indigo-600)
```

### Modern Theme (Light)
Clean light theme for daytime use.

```
Background:       bg-slate-50
Card Background:  bg-white
Card Border:      border-slate-200
Text Primary:     text-slate-900
Text Secondary:   text-slate-600
Accent:           indigo
```

---

## Color Palette

### Primary Actions
- **Primary Button**: `bg-indigo-600 hover:bg-indigo-500 text-white`
- **Primary Text Link**: `text-indigo-400 hover:text-indigo-300`

### Semantic Colors
| Purpose | Color | Usage |
|---------|-------|-------|
| Success | `emerald` | Confirmations, active states, TC role |
| Warning | `amber` | Caution states, Team Leader role |
| Error | `red` | Errors, destructive actions |
| Info | `blue` | Information, current week indicator |

### Role Colors
- **Team Leader**: `amber-400` to `amber-600` gradient, `text-amber-400`
- **Team Coordinator**: `emerald-500` to `emerald-700` gradient, `text-emerald-400`

---

## Typography

Using system fonts via Tailwind defaults.

### Hierarchy
| Element | Classes |
|---------|---------|
| Page Title | `text-5xl font-bold` |
| Section Title | `text-2xl font-bold` |
| Card Title | `text-xl font-bold` |
| Body | `text-sm` or `text-base` |
| Caption | `text-xs text-slate-500` |
| Label | `text-sm font-medium text-slate-400` |

### Special Text
- **Monospace**: `font-mono` for batch numbers, codes
- **Uppercase Labels**: `text-[10px] font-bold uppercase tracking-wider`

---

## Spacing

Use Tailwind's spacing scale consistently:
- **Section padding**: `p-4` to `p-12`
- **Card padding**: `p-3` to `p-4`
- **Element gaps**: `gap-2`, `gap-3`, `gap-4`
- **Form field spacing**: `space-y-5`

---

## Components

### Cards
```css
/* Midnight */
bg-slate-900 rounded-xl border border-slate-800

/* Modern */
bg-white rounded-xl border border-slate-200 shadow-sm
```

### Inputs
```css
/* Midnight */
bg-slate-900 border border-slate-800 rounded-lg
focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20
placeholder-slate-600 text-white

/* Input with icon prefix */
Left icon container: w-12, border-r, rounded-l-lg
Input: pl-14
```

### Buttons
```css
/* Primary */
bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg py-3.5

/* Secondary */
bg-slate-800 hover:bg-slate-700 text-white rounded-lg

/* Ghost */
text-slate-500 hover:text-slate-300 hover:bg-slate-800
```

### Focus States
All interactive elements must have visible focus states:
```css
focus:outline-none focus:ring-2 focus:ring-indigo-500/50
```

---

## Icons

Using **lucide-react** exclusively.

### Sizes
- Navigation: `w-5 h-5`
- Inline: `w-4 h-4`
- Decorative (large): `w-8 h-8` to `w-12 h-12`
- Decorative (background): `w-96 h-96` with `opacity-[0.03]`

### Common Icons
| Purpose | Icon |
|---------|------|
| Dashboard | `LayoutDashboard` |
| Schedule | `Calendar` |
| Team | `Users` |
| Settings | `Settings` |
| Bin/Package | `Box`, `Package`, `Boxes` |
| Team Leader | `Crown` |
| Team Coordinator | `Shield` |
| Sign Out | `LogOut` |
| Navigation | `ChevronRight`, `ArrowRight`, `ArrowLeft` |

---

## Animation & Transitions

### Timing
- Standard: `transition-colors`, `transition-all` (150ms default)
- Hover effects: `group-hover:translate-x-0.5 transition-transform`

### Loading States
- Spinner: `animate-spin` with `Loader2` icon
- Skeleton: `animate-pulse` with slate background

### Avoid
- Animations longer than 300ms
- Bouncy/springy effects (too playful)
- Animations that block user action

---

## Layout Patterns

### Split Screen (Auth Pages)
```
Desktop: 50/50 split
- Left: Decorative panel with branding (hidden on mobile)
- Right: Form content

Mobile: Full width form only
```

### Main App Layout
```
Sidebar (240px) | Main Content
- Sidebar: Navigation, user profile, current week
- Main: Page content with consistent padding
```

### Form Layout
- Single column for auth forms
- Labels above inputs
- Clear validation messages below inputs
- Grouped related fields

---

## Responsive Breakpoints

Using Tailwind defaults:
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px (split-screen kicks in)
- `xl`: 1280px
- `2xl`: 1536px

### Key Breakpoint Behaviors
- `lg:` - Show decorative left panel on auth pages
- `md:` - Adjust sidebar behavior
- Mobile-first approach throughout

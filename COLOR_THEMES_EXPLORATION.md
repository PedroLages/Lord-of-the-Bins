# Color Themes Feature Exploration

## Overview

This document explores the design space for a color themes system in Lord of the Bins. The goal is to improve task color management while maintaining visual clarity on the schedule grid.

---

## Current State

- 10 hardcoded preset colors
- Browser native color picker for custom colors
- No guidance on color usage
- No accessibility considerations
- Colors stored per-task in the database

---

## Feature Directions

### Direction A: Predefined Color Palettes (Swappable)

Users choose from curated palettes designed by professionals.

#### Proposed Palettes

**1. Standard (Current)**
```
#ef4444 Red       - High priority / Heavy tasks
#f97316 Orange    - Attention needed
#fbbf24 Amber     - Caution / Medium priority
#84cc16 Lime      - Active / In progress
#22c55e Green     - Complete / Light tasks
#0ea5e9 Sky       - Information / Standard
#6366f1 Indigo    - Primary actions
#a78bfa Violet    - Special / TC tasks
#f472b6 Pink      - Highlight
#64748b Slate     - Neutral / Inactive
```

**2. High Contrast**
Maximizes distinction between colors - ideal for dense schedules.
```
#dc2626 Red
#ea580c Orange
#facc15 Yellow
#16a34a Green
#0891b2 Cyan
#2563eb Blue
#7c3aed Purple
#db2777 Pink
#171717 Black
#737373 Gray
```

**3. Colorblind Safe (Deuteranopia/Protanopia)**
Avoids red-green confusion, uses blue-orange contrast.
```
#0077bb Blue
#33bbee Cyan
#009988 Teal
#ee7733 Orange
#cc3311 Vermillion
#ee3377 Magenta
#bbbbbb Gray
#000000 Black
#ffdd00 Yellow
#aa4499 Purple
```

**4. Soft/Muted (Reduced Eye Strain)**
Pastel tones for all-day use.
```
#fca5a5 Soft Red
#fdba74 Soft Orange
#fde047 Soft Yellow
#bef264 Soft Lime
#86efac Soft Green
#7dd3fc Soft Sky
#a5b4fc Soft Indigo
#c4b5fd Soft Violet
#f9a8d4 Soft Pink
#cbd5e1 Soft Slate
```

**5. Warehouse/Industrial**
Colors inspired by safety signage and industrial environments.
```
#dc2626 Danger Red
#f97316 Warning Orange
#facc15 Caution Yellow
#16a34a Safety Green
#0ea5e9 Information Blue
#7c3aed Process Purple
#78716c Industrial Brown
#1e293b Dark Navy
#f5f5f4 Light Gray
#27272a Charcoal
```

#### UX Flow
1. Settings → Appearance → Color Palette
2. Preview shows all colors with task examples
3. Changing palette updates ALL task colors via mapping
4. Tasks store a "color index" (0-9) not hex values
5. Palette change is instant, reversible

#### Pros
- Professionally designed, guaranteed to work
- Consistent look across all users
- Accessibility built-in
- Simple mental model

#### Cons
- Less customization freedom
- May not match company branding
- Limited to palette size

---

### Direction B: User-Created Custom Themes

Users build their own color palettes.

#### Features

**Theme Builder UI**
```
┌─────────────────────────────────────────────────────┐
│  My Custom Theme                            [Save]  │
├─────────────────────────────────────────────────────┤
│  Slot 1: [████] #3b82f6  "Primary"     [Pick] [×]  │
│  Slot 2: [████] #ef4444  "Urgent"      [Pick] [×]  │
│  Slot 3: [████] #22c55e  "Complete"    [Pick] [×]  │
│  ...                                                │
│  [+ Add Color Slot]                                 │
├─────────────────────────────────────────────────────┤
│  Preview on Schedule:                               │
│  ┌──────┬──────┬──────┐                            │
│  │ Mon  │ Tue  │ Wed  │                            │
│  ├──────┼──────┼──────┤                            │
│  │[████]│[████]│[████]│  <- Live preview           │
│  └──────┴──────┴──────┘                            │
├─────────────────────────────────────────────────────┤
│  ⚠️ Colors 2 & 5 are very similar                   │
│  ✓ All colors have good contrast                   │
└─────────────────────────────────────────────────────┘
```

**Smart Validation**
- Warn if two colors are too similar (delta E < 20)
- Check contrast against background (WCAG AA)
- Colorblind simulation preview
- "Fix issues" auto-suggest

**Theme Sharing**
- Export theme as JSON
- Import from file
- QR code for mobile sharing
- (Future) Company-wide theme sync

#### Data Model
```typescript
interface ColorTheme {
  id: string;
  name: string;
  type: 'system' | 'custom';
  colors: Array<{
    hex: string;
    name?: string;  // Optional label
  }>;
  createdAt?: Date;
  isDefault?: boolean;
}

// Storage
interface Settings {
  activeThemeId: string;
  customThemes: ColorTheme[];
}
```

#### Pros
- Maximum flexibility
- Company branding possible
- Users feel ownership
- Share themes between shifts/sites

#### Cons
- Users can create bad themes
- More complex UI
- Harder to maintain consistency
- Requires validation logic

---

### Direction C: Hybrid Approach (Recommended)

Combine both: Start with presets, allow customization.

#### Tiered System

**Tier 1: Palette Selection**
- 5 predefined palettes always available
- One-click switch
- No configuration needed

**Tier 2: Palette Customization**
- Start from any preset
- Modify individual colors
- "Reset to default" option
- Saved as "Custom (based on Standard)"

**Tier 3: Full Theme Builder**
- Create from scratch
- Advanced users only
- Hidden behind "Advanced" toggle

#### UX Hierarchy
```
Settings → Appearance
├── Theme: [Modern ▾] [Midnight ▾]     <- App theme (existing)
│
├── Task Colors
│   ├── Quick Select: ○ Standard  ○ High Contrast  ○ Colorblind Safe
│   │
│   ├── [Customize Palette...]         <- Opens Tier 2
│   │   └── Color grid with edit buttons
│   │
│   └── [Advanced: Create Theme...]    <- Opens Tier 3
│       └── Full theme builder
│
└── Preview
    └── Sample schedule with current colors
```

---

## Additional Features to Consider

### 1. Color Assignment Intelligence

**Auto-Suggest Based on Skill**
```
Skill: Decanting     → Suggest blue family
Skill: Troubleshooter → Suggest red/orange (heavy)
Skill: Exceptions    → Suggest amber/yellow
Skill: TC tasks      → Suggest purple family
```

**Conflict Detection**
When assigning colors:
- Show which colors are already in use
- Badge: "Used by 3 tasks"
- Suggest unused colors first

### 2. Accessibility Panel

```
┌─────────────────────────────────────────────────────┐
│  Accessibility Options                              │
├─────────────────────────────────────────────────────┤
│  ☑ Show patterns alongside colors                  │
│    ┌────┐ ┌────┐ ┌────┐                            │
│    │░░░░│ │////│ │====│  Task badges get patterns  │
│    └────┘ └────┘ └────┘                            │
│                                                     │
│  ☐ High contrast mode                              │
│    Increases border thickness, adds outlines       │
│                                                     │
│  ☐ Colorblind preview                              │
│    [Deuteranopia ▾]  [Preview Schedule]            │
└─────────────────────────────────────────────────────┘
```

### 3. Color Usage Analytics

Show how colors are distributed:
```
Color Usage:
██████████████ Blue (5 tasks)
████████ Red (3 tasks)
████ Green (2 tasks)
██ Orange (1 task)
░░░░░░░░░░░░░░ Unused (4 colors)
```

### 4. Semantic Color Mapping

Define meaning for color positions:
```
Position 1: "Primary/Default"     → New tasks get this
Position 2: "Urgent/Heavy"        → Heavy task suggestions
Position 3: "Complete/Light"      → Light task suggestions
Position 4-8: "Standard"          → Regular tasks
Position 9: "TC/Special"          → Coordinator tasks
Position 10: "Neutral/Inactive"   → Disabled/inactive
```

---

## Implementation Phases

### Phase 1: Foundation (MVP)
- [ ] Add 5 predefined palettes to constants
- [ ] Palette selector in Settings → Appearance
- [ ] Store active palette ID in settings
- [ ] Migrate tasks from hex → color index
- [ ] Update all color rendering to use active palette

### Phase 2: Smart Assignment
- [ ] "Already used" indicator on color picker
- [ ] Suggest unused colors when creating tasks
- [ ] Similar color warning

### Phase 3: Customization
- [ ] Palette customization (edit existing)
- [ ] Save custom palettes
- [ ] Reset to default

### Phase 4: Accessibility
- [ ] Colorblind preview mode
- [ ] Optional patterns on badges
- [ ] High contrast toggle

### Phase 5: Advanced (Future)
- [ ] Full theme builder
- [ ] Theme import/export
- [ ] Company theme sharing

---

## Questions to Decide

1. **Should palette change affect existing task colors?**
   - Option A: Yes, all tasks update (simpler, consistent)
   - Option B: No, only new tasks (preserves user choices)

2. **How many color slots per palette?**
   - 10 (current) - enough for most warehouses
   - 12 - more breathing room
   - 16 - handle large operations

3. **Store hex or index?**
   - Hex: More flexible, but palette changes don't cascade
   - Index: Palette changes work, but less flexible

4. **Where does this live in Settings?**
   - New "Appearance" tab
   - Under existing theme selector
   - In Tasks tab (close to where colors are used)

---

## Mockup: Palette Selector

```
┌─────────────────────────────────────────────────────────────────┐
│  Task Color Palette                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ● Standard                                                     │
│    ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐                    │
│    │██││██││██││██││██││██││██││██││██││██│                    │
│    └──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘                    │
│    The default palette with vibrant, distinct colors            │
│                                                                 │
│  ○ High Contrast                                                │
│    ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐                    │
│    │██││██││██││██││██││██││██││██││██││██│                    │
│    └──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘                    │
│    Maximum distinction for dense schedules                      │
│                                                                 │
│  ○ Colorblind Safe                                              │
│    ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐        ♿          │
│    │██││██││██││██││██││██││██││██││██││██│   Accessible       │
│    └──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘                    │
│    Optimized for color vision deficiency                        │
│                                                                 │
│  ○ Soft & Muted                                                 │
│    ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐                    │
│    │░░││░░││░░││░░││░░││░░││░░││░░││░░││░░│                    │
│    └──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘                    │
│    Pastel tones, easier on the eyes                             │
│                                                                 │
│  ○ Industrial                                                   │
│    ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐                    │
│    │██││██││██││██││██││██││██││██││██││██│                    │
│    └──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘└──┘                    │
│    Inspired by warehouse safety signage                         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  [Customize Current Palette...]                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Mockup: Custom Theme Builder

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Palettes              Custom Theme Builder           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Theme Name: [My Warehouse Theme_________]                      │
│                                                                 │
│  Base Palette: [Standard ▾]  [Reset All]                        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Colors                                                   │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  1. [████] #ef4444  Primary Red      [🎨] [↺]           │   │
│  │  2. [████] #f97316  Warning Orange   [🎨] [↺]           │   │
│  │  3. [████] #fbbf24  Caution Yellow   [🎨] [↺]           │   │
│  │  4. [████] #84cc16  Active Lime      [🎨] [↺]           │   │
│  │  5. [████] #22c55e  Success Green    [🎨] [↺]           │   │
│  │  6. [████] #0ea5e9  Info Blue        [🎨] [↺]           │   │
│  │  7. [████] #6366f1  Primary Indigo   [🎨] [↺]           │   │
│  │  8. [████] #a78bfa  Special Violet   [🎨] [↺]           │   │
│  │  9. [████] #f472b6  Highlight Pink   [🎨] [↺]           │   │
│  │ 10. [████] #64748b  Neutral Slate    [🎨] [↺]           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Validation:                                                    │
│  ├ ✓ All colors meet contrast requirements                     │
│  ├ ⚠️ Colors 2 & 3 are similar (consider adjusting)            │
│  └ ✓ Colorblind friendly                                       │
│                                                                 │
│  Preview:                                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Mon      │ Tue      │ Wed      │ Thu      │ Fri       │   │
│  │┌────────┐│┌────────┐│┌────────┐│┌────────┐│┌────────┐ │   │
│  ││Decant  │││Exception│││Process │││Trouble │││Decant  │ │   │
│  │└────────┘│└────────┘│└────────┘│└────────┘│└────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  [Cancel]                              [Save Theme] [Apply Now] │
└─────────────────────────────────────────────────────────────────┘
```

---

## Next Steps

1. Review this exploration
2. Decide on approach (A, B, or C)
3. Prioritize features for MVP
4. Create implementation plan
5. Design UI mockups in detail
6. Implement Phase 1

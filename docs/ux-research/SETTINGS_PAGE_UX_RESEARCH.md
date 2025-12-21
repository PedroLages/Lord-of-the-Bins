# Settings Page UX Research & Recommendations
## Lord of the Bins - Configuration Interface Design

**Research Date:** December 13, 2025
**Focus:** Modern settings page design patterns for warehouse scheduling applications

---

## Executive Summary

This research examines best practices for settings/configuration page design in modern web applications, with specific recommendations for Lord of the Bins' warehouse scheduling system. Key findings emphasize **progressive disclosure**, **auto-save for simple toggles**, **clear visual hierarchy**, and **context-aware organization** to support both Team Coordinators and Team Leaders in their distinct workflows.

---

## 1. Settings Page Organization Patterns

### Leading Applications Analysis

**Modern approaches observed in Notion, Linear, Figma, Slack:**

1. **Left Navigation Pattern** (Recommended for Lord of the Bins)
   - Persistent sidebar with setting categories
   - Main content area shows selected category
   - Users can see category structure at all times
   - Best for 5-9 distinct categories with multiple options each

2. **Tabbed Interface** (Alternative for simpler cases)
   - Horizontal tabs for 2-9 similar categories
   - Works best when categories have short names
   - Users need to switch between sections frequently
   - Not ideal when users need to compare settings across tabs

3. **Single-Page Sections** (Current approach in Lord of the Bins)
   - All settings on one scrollable page with section headers
   - Best when total settings count is low (<15 options)
   - Reduces cognitive load but can become unwieldy as settings grow

### Research Finding
**83% of users can find settings they need when navigation stays clear and uniform** (iOS Settings study). Consistency in placement and visual patterns is crucial for usability.

---

## 2. Information Architecture: Tabs vs. Sections

### When to Use Tabs

✅ **Use tabs when:**
- You have 2-9 distinct setting categories
- Users switch between categories frequently as part of workflow
- Categories sit under the same parent (e.g., Profile → Security, Account, Logout)
- Content within each tab doesn't need to be compared simultaneously
- Tab labels can be short and descriptive

❌ **Avoid tabs when:**
- Users need to see information from multiple tabs at once
- Settings have complex dependencies across categories
- You can't find distinct groupings through card sorting
- More than 9 categories (creates crowded tab bar)

### When to Use Sections

✅ **Use sections when:**
- Settings are closely related and sequential
- Users benefit from seeing all options at once
- Total options are manageable (<20)
- Settings flow logically from top to bottom
- Information hierarchy is shallow

### Current Lord of the Bins Implementation

**Observation:** Settings view currently uses a single-page approach with the TaskRequirementsSettings component. This is appropriate for the current scope but should evolve as features expand.

**Recommendation:** Implement a **hybrid left-navigation + sections** pattern:

```
Settings Sidebar:
├── Scheduling Rules
├── Task Requirements     ← Current TaskRequirementsSettings
├── Team Configuration
├── Algorithm Settings    ← New section for algorithm selection
├── Profile & Account
└── Export & Data
```

Each section would be a separate component rendered in the main area, with sections internally organized using subsections and cards.

---

## 3. Auto-Save vs. Manual Save

### Critical Decision Matrix

#### AUTO-SAVE (Instant Apply)

**When to use:**
- ✅ **Toggle switches** - Users expect immediate feedback (like a light switch)
- ✅ **Changes with no side effects** - Theme selection, notification preferences
- ✅ **Single-value changes** - Dropdown selections that don't affect other settings
- ✅ **User expectation is instant** - Dark mode, language selection

**Current example in Lord of the Bins:**
- Theme toggle (Modern/Midnight) - Already auto-saves ✓
- Task visibility toggles - Would benefit from auto-save

#### MANUAL SAVE (Explicit Submit)

**When to use:**
- ✅ **Complex forms with multiple related fields** - TaskRequirementsSettings (current approach)
- ✅ **Changes that impact others** - Operator assignments, schedule publications
- ✅ **Settings requiring review** - Task requirements, scheduling rules
- ✅ **Sensitive/destructive actions** - Delete operator, reset schedule
- ✅ **Users need ability to discard changes** - Experimentation with settings

**Current example in Lord of the Bins:**
```typescript
// TaskRequirementsSettings.tsx - CORRECT use of manual save
// Users configure multiple operator type requirements, then click "Save Requirements"
// This allows experimentation and review before committing
```

### UX Best Practice: Never Mix Patterns on Same Page

⚠️ **Critical Rule:** Don't have some settings auto-save while others require manual save on the same page. This creates confusion about whether changes are persisted.

**Research Quote:** *"Users shouldn't mix autosave elements with save-is-required elements on the same page, as this might be confusing."* - UX: Autosave or explicit save action

### Feedback & Communication

When using **auto-save:**
1. Show "Saving..." indicator while in progress
2. Display "Saved" confirmation briefly (toast or inline)
3. Offer "Undo" option for 5-10 seconds
4. Don't hide save completely - consider showing "All changes saved" status

When using **manual save:**
1. Show unsaved changes indicator (e.g., red dot on Save button)
2. Warn before navigating away with unsaved changes
3. Disable save button when no changes exist
4. Clear indication of what will be saved

---

## 4. Progressive Disclosure for Advanced Settings

### Core Principle

**Progressive disclosure defers advanced or rarely used features to a secondary screen, making applications easier to learn and less error-prone.** - Jakob Nielsen, 1995

### Benefits

1. **For Novice Users:** Focus on essential options, avoid mistakes, save time
2. **For Advanced Users:** Skip past clutter, faster access to frequently used options
3. **Improves:** Learnability, efficiency of use, error rate

### UI Patterns for Implementation

#### Pattern 1: Collapsible Sections (Current Implementation)

**Lord of the Bins already uses this effectively:**

```typescript
// TaskRequirementsSettings.tsx
const [expandedTask, setExpandedTask] = useState<string | null>(null);

// Task cards collapse/expand to show configuration panel
// ✅ Good: Only shows complexity when user requests it
// ✅ Good: Clear indication of expanded state with different border colors
```

**Enhancement Opportunity:**
```typescript
// Add "Show Advanced" toggle within expanded sections
{isExpanded && (
  <>
    {/* Basic options always visible */}
    <OperatorTypeRequirements />

    {/* Advanced options hidden behind toggle */}
    {showAdvanced && (
      <DaySpecificOverrides />
      <PriorityWeighting />
    )}
  </>
)}
```

#### Pattern 2: "Advanced Settings" Button

For the Scheduling Rules section:

```
[Basic Settings - Always Visible]
☑ Strict Skill Matching
☑ Fair Distribution
☑ Balance Workload

[🔧 Show Advanced Options ▼]  ← Collapsed by default

[When Expanded:]
☑ Allow Consecutive Heavy Shifts
🎚 Randomization Factor: 10%
🎚 Max Consecutive Days: 2
📋 Heavy Tasks: Troubleshooter, Quality checker, ...
```

#### Pattern 3: Role-Based Progressive Disclosure

**Context:** Lord of the Bins has two user roles with different needs:

- **Team Coordinators (TC):** Need simplified view focused on their shift
- **Team Leaders (Admin):** Need full control and advanced options

**Implementation:**
```typescript
const getAvailableSettings = (user: DemoUser) => {
  const baseSettings = [
    'task-requirements',
    'profile',
  ];

  if (user.role === 'admin') {
    return [
      ...baseSettings,
      'scheduling-rules',     // Admin only
      'algorithm-selection',  // Admin only
      'team-configuration',   // Admin only
      'export-data',          // Admin only
    ];
  }

  return baseSettings; // TC sees fewer options
};
```

### Research Recommendation

**Chrome Browser Example:** "Look at your Chrome browser, if you go to settings, you will see a limited amount of options, which thanks to card sortings and % of use are the most used, but we always have clearly available the advanced options."

**Applied to Lord of the Bins:**
- Show 5-7 most-used settings immediately
- "Advanced" section clearly visible but collapsed
- Use analytics to determine which settings are changed most frequently

---

## 5. Toggle Switch Best Practices

### Core Principles

#### 1. Toggles = Immediate Action

**Rule:** Toggle switches should take immediate effect and should NOT require Save/Submit button.

**Exception in Lord of the Bins:** Task requirement settings page uses manual save for the entire form (appropriate because it's a complex configuration with dependencies).

#### 2. When to Use Toggle Switches

✅ **Appropriate uses:**
- System state changes (Dark Mode ON/OFF)
- Binary options (Notifications Enabled/Disabled)
- Feature flags (Auto-assign Coordinators: Yes/No)
- Actions that are easily reversible

❌ **Avoid for:**
- Actions requiring confirmation (Delete account)
- Opposing choices (Light Theme vs. Dark Theme) → Use radio buttons or segmented control
- Multiple options (Small/Medium/Large) → Use dropdown or segmented control
- Settings with dependencies that need review

#### 3. Visual Design Standards

**Must-haves:**
- **Clear ON/OFF states** - Strong color contrast (e.g., green ON, gray OFF)
- **Minimum tap target** - 44px on mobile devices
- **Labels** - "On"/"Off" text near switch helps accessibility
- **Smooth animation** - Toggle motion should feel responsive (200-300ms)

**Current implementation check:**
```typescript
// Example toggle for scheduling rules
<label className="flex items-center justify-between">
  <span>Strict Skill Matching</span>
  <input
    type="checkbox"
    checked={rules.strictSkillMatching}
    onChange={(e) => updateRule('strictSkillMatching', e.target.checked)}
    className="toggle-switch" // Ensure this has proper styling
  />
</label>
```

### Handling Dependent Settings

**Problem:** Some settings only make sense when parent setting is enabled.

**Solution: Responsive Enabling Pattern**

```typescript
// Parent toggle
<Toggle
  label="Fair Distribution"
  checked={rules.fairDistribution}
  onChange={(val) => updateRule('fairDistribution', val)}
/>

{/* Dependent settings - visually disabled when parent is off */}
<div className={!rules.fairDistribution ? 'opacity-50 pointer-events-none' : ''}>
  <Toggle
    label="Balance Workload"
    checked={rules.balanceWorkload}
    onChange={(val) => updateRule('balanceWorkload', val)}
    disabled={!rules.fairDistribution}
  />
  <p className="text-xs text-gray-500">
    Only applies when Fair Distribution is enabled
  </p>
</div>
```

**Visual Hierarchy:**
- Parent settings: Full color, bold label
- Child settings: Indented, slightly muted when parent is disabled
- Help text explains dependency

### Alternatives for Complex Dependencies

**When toggle doesn't work well:**

❌ **Bad:** Toggle for "Algorithm Selection" (multiple options, not binary)
✅ **Good:** Dropdown or segmented control:

```typescript
// Not a toggle - use segmented control
const ALGORITHMS = ['greedy', 'enhanced', 'greedy-tabu', 'multi-objective'];

<div className="algorithm-selector">
  <label>Scheduling Algorithm</label>
  <SegmentedControl
    options={ALGORITHMS.map(a => ({ value: a, label: a }))}
    value={rules.algorithm}
    onChange={(val) => updateRule('algorithm', val)}
  />
</div>
```

---

## 6. Settings Dependencies & Conditional UI

### Common Dependency Types

#### Type 1: Enable/Disable Dependencies

**Example in Lord of the Bins:**
```
Auto-assign Coordinators [ON]
  └─> When ON: TC tasks get automatically filled
  └─> When OFF: Manual TC assignment required

Impact: Changes how Smart Fill algorithm operates
```

**UX Pattern:**
```typescript
{rules.autoAssignCoordinators && (
  <InfoBox variant="success">
    ✓ TC tasks will be automatically assigned during Smart Fill
  </InfoBox>
)}

{!rules.autoAssignCoordinators && (
  <InfoBox variant="warning">
    ⚠ You'll need to manually assign TCs to People/Process tasks
  </InfoBox>
)}
```

#### Type 2: Value-Based Dependencies

**Example:**
```
Algorithm: Enhanced
  └─> Shows: Constraint propagation options
  └─> Hides: Tabu search settings

Algorithm: Greedy-Tabu
  └─> Shows: Tabu search iterations, list size
  └─> Hides: Multi-objective options
```

**Implementation:**
```typescript
<Select value={rules.algorithm} onChange={...}>
  <option value="greedy">Greedy (Fast)</option>
  <option value="enhanced">Enhanced (Recommended)</option>
  <option value="greedy-tabu">Greedy + Tabu Search</option>
  <option value="multi-objective">Multi-Objective</option>
</Select>

{/* Conditional panels based on selection */}
{rules.algorithm === 'greedy-tabu' && (
  <Panel title="Tabu Search Settings">
    <NumberInput
      label="Iterations"
      value={rules.tabuSearchIterations}
      onChange={...}
    />
  </Panel>
)}

{rules.algorithm === 'multi-objective' && (
  <Panel title="Multi-Objective Settings">
    <Toggle
      label="Generate Pareto Front"
      checked={rules.generateParetoFront}
      onChange={...}
    />
  </Panel>
)}
```

#### Type 3: Conflicting Settings

**Example:**
```
Strict Skill Matching [ON]
  └─> Conflicts with: Prioritize Flex for Exceptions
  └─> Reason: Can't prioritize Flex if strict skill match required
```

**UX Pattern - Validation with Guidance:**
```typescript
const conflicts = validateRuleConflicts(rules);

{conflicts.length > 0 && (
  <Alert variant="warning">
    <AlertTitle>Setting Conflicts Detected</AlertTitle>
    <ul>
      {conflicts.map((conflict, i) => (
        <li key={i}>{conflict.message}</li>
      ))}
    </ul>
    <Button onClick={resolveConflicts}>Auto-Resolve</Button>
  </Alert>
)}
```

### Visual Patterns for Dependencies

#### 1. Indentation

```
☑ Fair Distribution
  ☑ Balance Workload          ← Indented, shows hierarchy
  ☑ Respect Preferred Stations
```

#### 2. Disabled State with Tooltip

```typescript
<Tooltip content="Enable 'Fair Distribution' first">
  <Toggle
    label="Balance Workload"
    disabled={!rules.fairDistribution}
    checked={rules.balanceWorkload}
  />
</Tooltip>
```

#### 3. Expandable Sections

```
☑ Advanced Scheduling
  [▼ Show 5 advanced options]  ← Collapsed by default

  When expanded:
  ☑ Allow Consecutive Heavy Shifts
  🎚 Randomization Factor
  ...
```

---

## 7. Inline Help vs. Tooltips vs. Documentation

### Three-Tier Help System

#### Tier 1: Inline Help (Always Visible)

**Use for:**
- Critical information users need to make decisions
- Explanations of non-obvious consequences
- Examples of how a setting works

**Example from TaskRequirementsSettings.tsx:**
```typescript
// ✅ Good: Help panel always visible
<div className="help-section">
  <h3>How Requirements Work</h3>
  <div>
    <strong>Any:</strong> Any operator type can fill this slot
    <strong>Regular:</strong> Must be a Regular (full-time) operator
    ...
  </div>
  <div>
    <strong>Example:</strong> Setting "2 Flex + 1 Regular" means
    Smart Fill will assign 2 Flex operators and 1 Regular operator
    to this task each day.
  </div>
</div>
```

**Best Practices:**
- Use collapsible info boxes for longer explanations
- Icon: `<AlertCircle>` or `<HelpCircle>` in blue/info color
- Keep examples concrete and specific to the setting

#### Tier 2: Tooltips (On Hover/Focus)

**Use for:**
- Brief clarifications (1-2 sentences max)
- Technical terms that need definitions
- Supplementary information

**Implementation:**
```typescript
import { Tooltip } from './components/Tooltip';

<Tooltip content="Operators marked as Regular in their profile">
  <label className="flex items-center gap-2">
    <HelpCircle className="h-4 w-4 text-gray-400" />
    Regular Operators
  </label>
</Tooltip>
```

**Best Practices:**
- Keep under 80 characters if possible
- Don't rely solely on tooltips for critical info (accessibility)
- Show on both hover and keyboard focus
- Position intelligently (above/below based on screen space)

#### Tier 3: Documentation Links

**Use for:**
- Detailed explanations and tutorials
- Complex features requiring more than a paragraph
- Visual diagrams and examples

**Implementation:**
```typescript
<div className="setting-section">
  <div className="flex items-center justify-between">
    <h3>Scheduling Algorithm</h3>
    <a
      href="/docs/scheduling-algorithms"
      target="_blank"
      className="text-sm text-blue-600 hover:underline flex items-center gap-1"
    >
      Learn more
      <ExternalLink className="h-3 w-3" />
    </a>
  </div>
  {/* Algorithm settings */}
</div>
```

### Help Content Guidelines

**DO:**
- ✅ Use plain language, not jargon
- ✅ Explain consequences: "Enabling this will..."
- ✅ Provide concrete examples
- ✅ Show defaults: "Default: 2 days"
- ✅ Indicate impact: "Affects: Schedule generation"

**DON'T:**
- ❌ Repeat the label: "Strict Skill Matching: Enables strict skill matching"
- ❌ Use technical terms without explanation
- ❌ Hide critical information in tooltips only
- ❌ Overwhelm with too much text

### Contextual Help Patterns

**Pattern: Help That Appears When Needed**

```typescript
const [selectedAlgorithm, setSelectedAlgorithm] = useState('greedy');

<AlgorithmSelector onChange={setSelectedAlgorithm} />

{/* Contextual help based on selection */}
{selectedAlgorithm === 'greedy' && (
  <InfoBox>
    Fast algorithm suitable for daily scheduling.
    Runs in <1 second for typical team sizes.
  </InfoBox>
)}

{selectedAlgorithm === 'multi-objective' && (
  <WarningBox>
    Advanced algorithm that explores trade-offs.
    May take 5-10 seconds to generate multiple schedule options.
  </WarningBox>
)}
```

---

## 8. Recommendations for Lord of the Bins

### Immediate Improvements (Current Sprint)

#### 1. Add Settings Navigation Structure

**Create:** `/components/SettingsLayout.tsx`

```typescript
const SETTING_CATEGORIES = [
  { id: 'scheduling', label: 'Scheduling Rules', icon: Sliders },
  { id: 'tasks', label: 'Task Requirements', icon: Users },
  { id: 'algorithm', label: 'Algorithm', icon: Cpu },
  { id: 'profile', label: 'Profile & Account', icon: User },
];

function SettingsLayout({ currentUser }) {
  const [activeSection, setActiveSection] = useState('scheduling');

  return (
    <div className="flex h-full">
      {/* Left sidebar */}
      <nav className="w-64 border-r">
        {SETTING_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveSection(cat.id)}
            className={activeSection === cat.id ? 'active' : ''}
          >
            <cat.icon />
            {cat.label}
          </button>
        ))}
      </nav>

      {/* Main content */}
      <main className="flex-1 p-6">
        {activeSection === 'scheduling' && <SchedulingRulesSettings />}
        {activeSection === 'tasks' && <TaskRequirementsSettings />}
        {activeSection === 'algorithm' && <AlgorithmSettings />}
        {activeSection === 'profile' && <ProfileSettings />}
      </main>
    </div>
  );
}
```

#### 2. Extract Scheduling Rules to Separate Component

**Create:** `/components/SchedulingRulesSettings.tsx`

Current rules are defined in `schedulingService.ts` but not exposed in UI. Create a settings panel:

```typescript
function SchedulingRulesSettings({ rules, onUpdate, theme }) {
  return (
    <div className="space-y-6">
      <Header
        title="Scheduling Rules"
        description="Configure how Smart Fill generates schedules"
      />

      {/* Basic Rules - Always Visible */}
      <Section title="Basic Rules">
        <ToggleSetting
          label="Strict Skill Matching"
          description="Only assign operators to tasks matching their skills"
          checked={rules.strictSkillMatching}
          onChange={(val) => onUpdate('strictSkillMatching', val)}
          autoSave
        />

        <ToggleSetting
          label="Fair Distribution"
          description="Distribute tasks evenly across team"
          checked={rules.fairDistribution}
          onChange={(val) => onUpdate('fairDistribution', val)}
          autoSave
        />
      </Section>

      {/* Advanced Rules - Progressive Disclosure */}
      <Collapsible title="Advanced Options" icon={Settings}>
        <ToggleSetting
          label="Allow Consecutive Heavy Shifts"
          description="Let operators work heavy tasks multiple days in a row"
          checked={rules.allowConsecutiveHeavyShifts}
          onChange={(val) => onUpdate('allowConsecutiveHeavyShifts', val)}
          autoSave
        />

        <NumberSetting
          label="Randomization Factor"
          description="Add variety to schedule generation (0-100%)"
          value={rules.randomizationFactor}
          min={0}
          max={100}
          onChange={(val) => onUpdate('randomizationFactor', val)}
          requiresSave
        />
      </Collapsible>

      {/* Help Section */}
      <HelpPanel>
        <h4>Understanding Scheduling Rules</h4>
        <p>These rules control how the Smart Fill algorithm assigns
           operators to tasks...</p>
      </HelpPanel>
    </div>
  );
}
```

#### 3. Add Algorithm Selection UI

**Create:** `/components/AlgorithmSettings.tsx`

Expose the algorithm selection currently hidden in `schedulingService.ts`:

```typescript
function AlgorithmSettings({ rules, onUpdate }) {
  const algorithms = [
    {
      value: 'greedy',
      label: 'Greedy (Fast)',
      description: 'Standard algorithm, runs in <1 second',
      icon: Zap,
      recommended: false,
    },
    {
      value: 'enhanced',
      label: 'Enhanced (Recommended)',
      description: 'Constraint propagation for better quality',
      icon: Award,
      recommended: true,
    },
    {
      value: 'greedy-tabu',
      label: 'Greedy + Tabu Search',
      description: 'Slower but higher quality results',
      icon: TrendingUp,
      recommended: false,
    },
    {
      value: 'multi-objective',
      label: 'Multi-Objective',
      description: 'Explore trade-offs, generates multiple options',
      icon: BarChart3,
      recommended: false,
    },
  ];

  return (
    <RadioGroup value={rules.algorithm} onChange={onUpdate}>
      {algorithms.map(algo => (
        <AlgorithmCard key={algo.value} {...algo} />
      ))}
    </RadioGroup>
  );
}
```

#### 4. Improve TaskRequirementsSettings Save Flow

**Current state:** Already uses manual save (correct!)
**Enhancement:** Add unsaved changes warning

```typescript
// In TaskRequirementsSettings.tsx
const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

useEffect(() => {
  // Warn before leaving with unsaved changes
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = '';
    }
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [hasUnsavedChanges]);

// Visual indicator
{hasUnsavedChanges && (
  <div className="unsaved-changes-badge">
    Unsaved changes
  </div>
)}
```

### Medium-Term Enhancements (Next Sprint)

#### 5. Add Settings Search

For when settings grow beyond ~20 options:

```typescript
function SettingsSearch({ onNavigate }) {
  const [query, setQuery] = useState('');
  const searchableSettings = [
    { id: 'strict-skill', label: 'Strict Skill Matching', section: 'scheduling' },
    { id: 'algorithm', label: 'Algorithm Selection', section: 'algorithm' },
    // ... all settings
  ];

  const results = searchableSettings.filter(s =>
    s.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="settings-search">
      <input
        type="search"
        placeholder="Search settings..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {results.map(result => (
        <button onClick={() => onNavigate(result.section, result.id)}>
          {result.label}
        </button>
      ))}
    </div>
  );
}
```

#### 6. Add Role-Based Settings Visibility

```typescript
// In SettingsLayout
const availableCategories = useMemo(() => {
  return SETTING_CATEGORIES.filter(cat => {
    // TC users only see limited settings
    if (currentUser.role === 'tc') {
      return ['tasks', 'profile'].includes(cat.id);
    }
    // Admins see everything
    return true;
  });
}, [currentUser.role]);
```

#### 7. Settings Presets/Templates

For common configurations:

```typescript
const SCHEDULING_PRESETS = [
  {
    name: 'Balanced',
    description: 'Equal focus on fairness and efficiency',
    rules: {
      fairDistribution: true,
      balanceWorkload: true,
      strictSkillMatching: true,
      randomizationFactor: 10,
    }
  },
  {
    name: 'Strict Quality',
    description: 'Maximum skill matching, minimal variety',
    rules: {
      strictSkillMatching: true,
      allowConsecutiveHeavyShifts: false,
      randomizationFactor: 0,
    }
  },
  {
    name: 'High Variety',
    description: 'More rotation and task mixing',
    rules: {
      randomizationFactor: 30,
      maxConsecutiveDaysOnSameTask: 1,
    }
  },
];

// UI
<div className="presets">
  <h4>Quick Presets</h4>
  {SCHEDULING_PRESETS.map(preset => (
    <PresetCard
      {...preset}
      onApply={() => applyPreset(preset.rules)}
    />
  ))}
</div>
```

### Long-Term Vision (Future Sprints)

#### 8. Settings Activity Log

Track who changed what and when:

```typescript
// Integration with existing activityLogService.ts
export function logSettingChanged(
  setting: string,
  oldValue: any,
  newValue: any,
  changedBy: string
) {
  return {
    type: 'setting_changed',
    timestamp: new Date().toISOString(),
    user: changedBy,
    details: {
      setting,
      oldValue,
      newValue,
    }
  };
}

// UI in Settings
<ActivityFeed>
  {recentChanges.map(change => (
    <div>
      <User>{change.user}</User> changed
      <Setting>{change.setting}</Setting> to
      <Value>{change.newValue}</Value>
      <Time>{formatRelativeTime(change.timestamp)}</Time>
    </div>
  ))}
</ActivityFeed>
```

#### 9. A/B Testing Framework for Scheduling Rules

Allow admins to test different rule configurations:

```typescript
function ScheduleComparison() {
  const [variantA, setVariantA] = useState(DEFAULT_RULES);
  const [variantB, setVariantB] = useState({ ...DEFAULT_RULES, randomizationFactor: 30 });

  return (
    <div className="schedule-comparison">
      <RulesPanel rules={variantA} onChange={setVariantA} label="Current" />
      <RulesPanel rules={variantB} onChange={setVariantB} label="Experiment" />

      <CompareButton onClick={() => generateBothSchedules(variantA, variantB)} />

      <ResultsPanel>
        {/* Show side-by-side schedules with quality metrics */}
      </ResultsPanel>
    </div>
  );
}
```

---

## 9. Visual Design System for Settings

### Component Hierarchy

```
SettingsPage
├── SettingsLayout (navigation + content)
│   ├── SettingsSidebar
│   │   ├── CategoryLink × N
│   │   └── SettingsSearch
│   └── SettingsContent
│       └── SettingSection
│           ├── SectionHeader
│           ├── SettingGroup
│           │   ├── ToggleSetting
│           │   ├── SelectSetting
│           │   ├── NumberSetting
│           │   └── TextSetting
│           ├── Collapsible (for advanced options)
│           └── HelpPanel
```

### Component Specifications

#### ToggleSetting (Auto-save)

```typescript
interface ToggleSettingProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  helpText?: string;
  autoSave?: boolean; // Show "Saved" indicator
}

// Usage
<ToggleSetting
  label="Strict Skill Matching"
  description="Only assign operators to tasks they're skilled for"
  checked={rules.strictSkillMatching}
  onChange={(val) => updateRule('strictSkillMatching', val)}
  autoSave
/>
```

#### NumberSetting (Range slider or input)

```typescript
interface NumberSettingProps {
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string; // '%', 'days', etc.
  onChange: (value: number) => void;
  requiresSave?: boolean; // Don't auto-apply
}

// Usage
<NumberSetting
  label="Randomization Factor"
  description="Add variety to schedules"
  value={rules.randomizationFactor}
  min={0}
  max={100}
  unit="%"
  onChange={(val) => updateRule('randomizationFactor', val)}
  requiresSave
/>
```

#### SelectSetting (Dropdown)

```typescript
interface SelectSettingProps {
  label: string;
  description?: string;
  value: string;
  options: Array<{ value: string; label: string; description?: string }>;
  onChange: (value: string) => void;
  autoSave?: boolean;
}

// Usage
<SelectSetting
  label="Scheduling Algorithm"
  value={rules.algorithm}
  options={[
    { value: 'greedy', label: 'Greedy (Fast)' },
    { value: 'enhanced', label: 'Enhanced (Recommended)' },
  ]}
  onChange={(val) => updateRule('algorithm', val)}
  autoSave
/>
```

### Theme Integration

Settings should respect current theme (Modern/Midnight):

```typescript
// Use existing THEME_STYLES from App.tsx
const styles = THEME_STYLES[theme];

<div className={`settings-page ${styles.bg} ${styles.text}`}>
  <div className={`setting-card ${styles.card}`}>
    <ToggleSetting
      className={`
        ${isDark ? 'border-slate-700' : 'border-gray-200'}
        ${isDark ? 'hover:bg-slate-800' : 'hover:bg-gray-50'}
      `}
    />
  </div>
</div>
```

---

## 10. Accessibility Considerations

### Keyboard Navigation

**All settings must be keyboard accessible:**

```typescript
// Settings navigation
<nav role="navigation" aria-label="Settings categories">
  <button
    role="tab"
    aria-selected={activeSection === 'scheduling'}
    onKeyDown={handleKeyDown} // Arrow keys to navigate
  >
    Scheduling Rules
  </button>
</nav>

// Toggle switches
<button
  role="switch"
  aria-checked={checked}
  aria-label="Strict skill matching"
  onKeyDown={(e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      onChange(!checked);
    }
  }}
/>
```

### Screen Reader Support

**Provide context for changes:**

```typescript
// Auto-save feedback
<div role="status" aria-live="polite" className="sr-only">
  {saveStatus === 'saving' && 'Saving changes...'}
  {saveStatus === 'saved' && 'Changes saved successfully'}
</div>

// Settings with dependencies
<Toggle
  label="Balance Workload"
  disabled={!fairDistribution}
  aria-describedby="balance-workload-help"
/>
<div id="balance-workload-help" className="sr-only">
  Requires Fair Distribution to be enabled first
</div>
```

### Color Contrast

**Ensure WCAG AA compliance:**

- Toggle ON state: High contrast (green on white, or indigo on dark)
- Toggle OFF state: Clear distinction (gray)
- Disabled settings: 3:1 contrast minimum
- Help text: 4.5:1 contrast minimum

---

## 11. Testing Recommendations

### Usability Testing Script

**Task 1: Find and change a basic setting**
1. "Enable strict skill matching"
2. Observe: Can they find it? Do they understand what it does?
3. Measure: Time to complete, errors made

**Task 2: Configure task requirements**
1. "Set Exceptions task to require 2 Flex operators"
2. Observe: Do they understand the expand/collapse pattern?
3. Measure: Can they complete without help?

**Task 3: Discover advanced options**
1. "Find the algorithm selection setting"
2. Observe: Do they know to look for "Advanced"?
3. Measure: Success rate

**Task 4: Understand setting impact**
1. "What happens if you enable 'Allow Consecutive Heavy Shifts'?"
2. Observe: Do they find help text? Is it clear?
3. Measure: Comprehension score

### A/B Testing Ideas

**Test A: Tabs vs. Left Navigation**
- Variant A: Horizontal tabs for settings categories
- Variant B: Left sidebar navigation
- Metric: Time to find specific setting, user preference rating

**Test B: Auto-save vs. Manual Save (for simple toggles)**
- Variant A: All toggles auto-save with "Saved" indicator
- Variant B: All settings require manual save
- Metric: User confusion rate, perceived reliability

**Test C: Progressive Disclosure Visibility**
- Variant A: "Advanced Options" collapsed by default
- Variant B: All options visible, advanced ones at bottom
- Metric: Overwhelm rating, task completion time

---

## 12. Summary of Key Recommendations

### Do Immediately

1. ✅ **Split settings into categories** with left navigation (Scheduling Rules, Task Requirements, Algorithm, Profile)
2. ✅ **Use auto-save for simple toggles**, manual save for complex forms (already correct for TaskRequirementsSettings)
3. ✅ **Add "Advanced Options" collapsible section** for rarely-used settings
4. ✅ **Show save status clearly** ("Saving...", "Saved", unsaved changes indicator)
5. ✅ **Add inline help** for all non-obvious settings with concrete examples

### Do Soon

6. ✅ **Implement role-based settings** (TC sees fewer options than Admin)
7. ✅ **Add settings search** when option count exceeds ~15
8. ✅ **Create SchedulingRulesSettings** component to expose hidden configuration
9. ✅ **Build AlgorithmSettings** UI for algorithm selection
10. ✅ **Add unsaved changes warning** before navigation

### Consider for Future

11. ✅ **Settings presets** ("Balanced", "Strict Quality", "High Variety")
12. ✅ **Activity log** for settings changes
13. ✅ **A/B testing framework** for rules comparison
14. ✅ **Onboarding tour** for first-time users
15. ✅ **Settings export/import** for sharing configurations between teams

---

## Research Sources

1. [8 Settings Page UI Examples: Design Patterns That Work](https://bricxlabs.com/blogs/settings-page-ui-examples)
2. [How to Improve App Settings UX | Toptal](https://www.toptal.com/designers/ux/settings-ux)
3. [The different types of "Saving" options — and how to choose the right one | Medium](https://medium.com/@adamshriki/the-different-types-of-saving-options-and-how-to-choose-the-right-one-22732d424714)
4. [UX: Autosave or explicit save action - which is better? | Damian Wajer](https://www.damianwajer.com/blog/autosave/)
5. [Progressive Disclosure - Nielsen Norman Group](https://www.nngroup.com/articles/progressive-disclosure/)
6. [What is Progressive Disclosure? | Interaction Design Foundation](https://www.interaction-design.org/literature/topics/progressive-disclosure)
7. [Toggle-Switch Guidelines - Nielsen Norman Group](https://www.nngroup.com/articles/toggle-switch-guidelines/)
8. [The art of toggle UI: where and when to use it? | Cieden](https://cieden.com/book/atoms/toggle-switch/the-art-of-toggle-ui)
9. [Tabs, Used Right - Nielsen Norman Group](https://www.nngroup.com/articles/tabs-used-right/)
10. [The Ultimate Guide to Tab Design | Lollypop Design](https://dev.to/lollypopdesign/the-ultimate-guide-to-tab-design-anatomy-types-and-tips-cdk)
11. [Top Warehouse Management Best Practices for 2025 | Logimax](https://www.logimaxwms.com/blog/warehouse-management-best-practices/)
12. [Warehouse Management Software Systems Guide 2025 | Handifox](https://www.handifox.com/handifox-blog/warehouse-management-software-systems-in-2025)

---

## Appendix: Current State Analysis

### Existing Settings Implementation

**File:** `/components/TaskRequirementsSettings.tsx` (674 lines)

**Strengths:**
- ✅ Proper use of manual save for complex form
- ✅ Progressive disclosure via expand/collapse cards
- ✅ Clear visual hierarchy with color-coded operator types
- ✅ Good use of inline help panel explaining how requirements work
- ✅ Summary statistics at top (Custom Configs, Daily Required, Total Tasks)
- ✅ Theme-aware styling (Modern/Midnight)

**Areas for Enhancement:**
- ⚠️ No unsaved changes warning when navigating away
- ⚠️ Could benefit from keyboard shortcuts (e.g., Cmd+S to save)
- ⚠️ No search/filter when task list grows large
- ⚠️ Could add "Reset All" functionality
- ⚠️ Could show validation errors inline before save

**File:** `/services/schedulingService.ts`

**Hidden Settings (Not exposed in UI):**
- SchedulingRules interface (20+ configuration options)
- Algorithm selection ('greedy', 'enhanced', 'greedy-tabu', 'multi-objective')
- Tabu search parameters
- Heavy/Soft task categorization
- Randomization factor

**Recommendation:** Create dedicated settings UI to expose these powerful configuration options to users.

---

**End of Research Document**

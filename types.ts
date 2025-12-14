export type WeekDay = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri';

// Operator types that can be specified in requirements
export type OperatorTypeOption = 'Regular' | 'Flex' | 'Coordinator';

// Single requirement entry: how many of a specific operator type
export interface OperatorTypeRequirement {
  type: OperatorTypeOption;
  count: number;
}

// Task staffing requirements configuration
export interface TaskRequirement {
  taskId: string;
  // Default requirements (applies to all days unless overridden)
  // e.g., [{type: 'Flex', count: 2}, {type: 'Regular', count: 1}] means 2 Flex + 1 Regular
  defaultRequirements: OperatorTypeRequirement[];
  // Optional per-day overrides (only specified days are overridden)
  dailyOverrides?: Partial<Record<WeekDay, OperatorTypeRequirement[]>>;
  // Whether this requirement is enabled (allows temporarily disabling)
  enabled?: boolean;
}

// Plan Builder Violation - Represents a mismatch between required and actual assignments
export interface PlanBuilderViolation {
  taskId: string;
  taskName: string;
  day: WeekDay;
  required: number;
  actual: number;
  type: 'over' | 'under';
  excess?: number; // for over-assignments (actual - required)
  shortage?: number; // for under-assignments (required - actual)
  operatorType: 'Regular' | 'Flex';
}

// ─────────────────────────────────────────────────────────────────
// Natural Language Rule Builder Types - For per-week staffing rules
// ─────────────────────────────────────────────────────────────────

// Timeframe options for when a rule applies
export type RuleTimeframe = 'every-day' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri';

// Conjunction type for combining requirements
export type ConjunctionType = 'AND' | 'OR';

// Operator types available in planning (Coordinators auto-scheduled separately)
export type PlanningOperatorType = 'Regular' | 'Flex';

// A single skill requirement within a numeric rule
// e.g., "3 Regular operators for Troubleshooter"
export interface SkillRequirement {
  id: string;
  count: number;
  operatorType: PlanningOperatorType;
  skill: string;
  conjunction?: ConjunctionType; // Conjunction BEFORE this item (ignored for first item)
}

// Numeric Staffing Rule - "I need X operators to do Y skill"
// Can chain multiple skill requirements with AND
// e.g., "I need 3 Regular for Troubleshooter AND 2 Flex for Exceptions every day"
export interface NumericStaffingRule {
  id: string;
  type: 'numeric';
  requirements: SkillRequirement[];  // All chained with AND
  timeframe: RuleTimeframe;
  selectedDays?: WeekDay[];  // Multi-day selection (overrides timeframe when present)
  enabled: boolean;
}

// People Rule Preference - controls whether we want or don't want something
export type PeopleRulePreference = 'want' | 'dont-want';

// Operator Pairing Rule - "I want/don't want OperatorA to do Skill" OR "I want/don't want OperatorA AND OperatorB together"
// Single operator: task assignment/restriction
// Multiple operators: pairing/separation
export interface OperatorPairingRule {
  id: string;
  type: 'pairing';
  operatorIds: string[];  // 1+ operators (single = assignment, multiple = pairing)
  operatorConjunctions?: ConjunctionType[];  // Conjunction between operators (index i is between operator i and i+1)
  skill: string;  // Required for 'want', optional for 'dont-want' separations
  timeframe: RuleTimeframe;  // Legacy: single day selection
  selectedDays?: WeekDay[];  // Multi-day selection (overrides timeframe when present)
  enabled: boolean;
  preference: PeopleRulePreference;  // 'want' (green) or 'dont-want' (red)
}

// Union type for all planning rules
export type PlanningRule = NumericStaffingRule | OperatorPairingRule;

// ─────────────────────────────────────────────────────────────────
// Operator Exclusions / Leave Management
// ─────────────────────────────────────────────────────────────────

// Reason for operator exclusion
export type ExclusionReason = 'vacation' | 'sick' | 'training' | 'other';

// Metadata for exclusion reasons
export const EXCLUSION_REASONS: Record<ExclusionReason, { label: string; icon: string; color: string }> = {
  vacation: { label: 'Vacation', icon: 'Palmtree', color: 'emerald' },
  sick: { label: 'Sick', icon: 'Thermometer', color: 'red' },
  training: { label: 'Training', icon: 'GraduationCap', color: 'blue' },
  other: { label: 'Other', icon: 'CircleDashed', color: 'slate' },
};

// Single operator exclusion entry
export interface OperatorExclusion {
  operatorId: string;
  reason: ExclusionReason;
  excludedDays?: WeekDay[];  // If empty/undefined = whole week excluded
  note?: string;             // Optional note about the exclusion
}

// Weekly exclusions configuration
export interface WeeklyExclusions {
  id: string;
  weekNumber: number;
  year: number;
  exclusions: OperatorExclusion[];
  createdAt: string;
  updatedAt?: string;
}

// Helper to check if an operator is excluded for a specific day
export function isOperatorExcludedForDay(
  exclusions: WeeklyExclusions | null | undefined,
  operatorId: string,
  day: WeekDay
): boolean {
  if (!exclusions) return false;
  const exclusion = exclusions.exclusions.find(e => e.operatorId === operatorId);
  if (!exclusion) return false;
  // If no specific days, whole week is excluded
  if (!exclusion.excludedDays || exclusion.excludedDays.length === 0) return true;
  return exclusion.excludedDays.includes(day);
}

// Helper to check if an operator is excluded for the entire week
export function isOperatorExcludedForWeek(
  exclusions: WeeklyExclusions | null | undefined,
  operatorId: string
): boolean {
  if (!exclusions) return false;
  const exclusion = exclusions.exclusions.find(e => e.operatorId === operatorId);
  if (!exclusion) return false;
  // Whole week if no specific days OR all 5 days selected
  return !exclusion.excludedDays || exclusion.excludedDays.length === 0 || exclusion.excludedDays.length === 5;
}

// Helper to get exclusion info for an operator
export function getOperatorExclusion(
  exclusions: WeeklyExclusions | null | undefined,
  operatorId: string
): OperatorExclusion | undefined {
  if (!exclusions) return undefined;
  return exclusions.exclusions.find(e => e.operatorId === operatorId);
}

// The full week planning configuration
export interface WeeklyPlanningConfig {
  id: string;
  weekNumber: number;
  year: number;
  rules: PlanningRule[];
  excludedTasks: string[];  // Task names to skip for this week (won't be scheduled)
  createdAt: string;
  updatedAt?: string;
}

// ─────────────────────────────────────────────────────────────────
// Planning Templates - Reusable configurations for Plan the Week
// ─────────────────────────────────────────────────────────────────

// Template exclusion (operator leave pattern without week-specific data)
export interface TemplateExclusion {
  operatorId: string;
  reason: ExclusionReason;
  excludedDays?: WeekDay[];  // If empty = whole week
  note?: string;
}

// Planning Template - Saveable "Plan the Week" configuration
export interface PlanningTemplate {
  id: string;
  name: string;                        // User-defined template name
  description?: string;                // Optional description
  exclusions: TemplateExclusion[];     // Leave patterns to apply
  rules?: PlanningRule[];              // Optional: saved planning rules
  createdAt: string;
  updatedAt?: string;
}

// Helper to create a template from current planning state
export function createPlanningTemplate(
  name: string,
  exclusions: OperatorExclusion[],
  rules?: PlanningRule[],
  description?: string
): PlanningTemplate {
  return {
    id: crypto.randomUUID(),
    name,
    description,
    exclusions: exclusions.map(e => ({
      operatorId: e.operatorId,
      reason: e.reason,
      excludedDays: e.excludedDays,
      note: e.note,
    })),
    rules,
    createdAt: new Date().toISOString(),
  };
}

// Helper to apply a template to create weekly exclusions
export function applyTemplateToWeek(
  template: PlanningTemplate,
  weekNumber: number,
  year: number
): WeeklyExclusions {
  return {
    id: crypto.randomUUID(),
    weekNumber,
    year,
    exclusions: template.exclusions.map(e => ({
      operatorId: e.operatorId,
      reason: e.reason,
      excludedDays: e.excludedDays,
      note: e.note,
    })),
    createdAt: new Date().toISOString(),
  };
}

// Helper to create an empty skill requirement
export function createEmptySkillRequirement(): SkillRequirement {
  return {
    id: crypto.randomUUID(),
    count: 1,
    operatorType: 'Regular',
    skill: '',
  };
}

// Helper to create an empty numeric staffing rule
export function createEmptyNumericRule(): NumericStaffingRule {
  return {
    id: crypto.randomUUID(),
    type: 'numeric',
    requirements: [createEmptySkillRequirement()],
    timeframe: 'every-day',
    enabled: true,
  };
}

// Helper to create an empty pairing rule
export function createEmptyPairingRule(): OperatorPairingRule {
  return {
    id: crypto.randomUUID(),
    type: 'pairing',
    operatorIds: [],
    skill: '',
    timeframe: 'every-day',
    selectedDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],  // Default to all days
    enabled: true,
    preference: 'want',  // Default to "I want"
  };
}

// Map day abbreviations to full names
const DAY_FULL_NAMES: Record<string, string> = {
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
  Fri: 'Friday',
};

// Helper to get display text for timeframe (for dropdowns)
export function getTimeframeDisplayText(timeframe: RuleTimeframe): string {
  if (timeframe === 'every-day') return 'Every day (Mon-Fri)';
  return DAY_FULL_NAMES[timeframe] || timeframe;
}

// Helper to get readable sentence text for timeframe (for readable sentences)
export function getTimeframeReadableText(timeframe: RuleTimeframe): string {
  if (timeframe === 'every-day') return 'Every day (Mon-Fri)';
  return `on ${DAY_FULL_NAMES[timeframe] || timeframe}`;
}

// All weekdays in order
export const ALL_WEEKDAYS: WeekDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

// Helper to get readable text for selected days array
export function getSelectedDaysReadableText(selectedDays: WeekDay[]): string {
  if (!selectedDays || selectedDays.length === 0) return '';
  if (selectedDays.length === 5) return 'every day (Mon-Fri)';
  if (selectedDays.length === 1) return `on ${DAY_FULL_NAMES[selectedDays[0]] || selectedDays[0]}`;

  // Sort days in week order
  const sorted = [...selectedDays].sort((a, b) =>
    ALL_WEEKDAYS.indexOf(a) - ALL_WEEKDAYS.indexOf(b)
  );

  const dayNames = sorted.map(d => DAY_FULL_NAMES[d] || d);
  if (dayNames.length === 2) {
    return `on ${dayNames[0]} and ${dayNames[1]}`;
  }
  return `on ${dayNames.slice(0, -1).join(', ')} and ${dayNames[dayNames.length - 1]}`;
}

// Helper to get the effective days from a rule (handles both timeframe and selectedDays)
export function getEffectiveDays(rule: NumericStaffingRule | OperatorPairingRule): WeekDay[] {
  if (rule.selectedDays && rule.selectedDays.length > 0) {
    return rule.selectedDays;
  }
  if (rule.timeframe === 'every-day') {
    return ALL_WEEKDAYS;
  }
  return [rule.timeframe as WeekDay];
}

// Helper to get total operators needed from a numeric rule
export function getTotalFromNumericRule(rule: NumericStaffingRule): number {
  return rule.requirements.reduce((sum, req) => sum + req.count, 0);
}

// Detect conflicts between rules (basic validation)
export interface RuleConflict {
  ruleIds: string[];
  message: string;
  severity: 'warning' | 'error';
}

export function detectRuleConflicts(rules: PlanningRule[]): RuleConflict[] {
  const conflicts: RuleConflict[] = [];

  // Check for duplicate skill requirements on same day that might exceed available operators
  const numericRules = rules.filter((r): r is NumericStaffingRule => r.type === 'numeric' && r.enabled);

  // Group by timeframe and skill to detect overlaps
  const skillDayMap = new Map<string, { ruleId: string; count: number; operatorType: PlanningOperatorType }[]>();

  for (const rule of numericRules) {
    const days = rule.timeframe === 'every-day'
      ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
      : [rule.timeframe];

    for (const day of days) {
      for (const req of rule.requirements) {
        const key = `${day}-${req.skill}`;
        if (!skillDayMap.has(key)) {
          skillDayMap.set(key, []);
        }
        skillDayMap.get(key)!.push({
          ruleId: rule.id,
          count: req.count,
          operatorType: req.operatorType,
        });
      }
    }
  }

  // Check for multiple rules targeting same skill on same day
  for (const [key, entries] of skillDayMap) {
    if (entries.length > 1) {
      const [day, skill] = key.split('-');
      const totalCount = entries.reduce((sum, e) => sum + e.count, 0);
      conflicts.push({
        ruleIds: entries.map(e => e.ruleId),
        message: `Multiple rules require "${skill}" on ${day} (total: ${totalCount} operators)`,
        severity: 'warning',
      });
    }
  }

  return conflicts;
}

// Helper to get total required operators from requirements array
export function getTotalFromRequirements(requirements: OperatorTypeRequirement[]): number {
  return requirements.reduce((sum, req) => sum + req.count, 0);
}

// Helper to get requirements for a specific day
export function getRequirementsForDay(
  taskReq: TaskRequirement,
  day: WeekDay
): OperatorTypeRequirement[] {
  if (taskReq.dailyOverrides?.[day]) {
    return taskReq.dailyOverrides[day]!;
  }
  return taskReq.defaultRequirements;
}

export interface TaskType {
  id: string;
  name: string;
  color: string; // Tailwind class mostly, or hex
  textColor: string;
  requiredSkill: string;
  // Number of operators required per day (defaults to 1 if not specified)
  // Can be a single number for all days or per-day configuration
  requiredOperators?: number | Record<WeekDay, number>;
  // If true, this skill is only assignable to coordinators and won't appear on the schedule grid
  isCoordinatorOnly?: boolean;
}

export interface Operator {
  id: string;
  name: string;
  skills: string[];
  type: 'Regular' | 'Flex' | 'Coordinator';
  status: 'Active' | 'Sick' | 'Leave';
  // Simple availability: true if available that day
  availability: Record<WeekDay, boolean>;
  // Preferred tasks - operators get priority for these assignments
  preferredTasks?: string[]; // Array of task names they prefer
  // Soft delete flag - archived operators are hidden but not permanently deleted
  archived?: boolean;
  archivedAt?: string; // ISO date string when archived
}

export interface ScheduleAssignment {
  taskId: string | null; // null means Off or Unassigned
  locked: boolean; // If true, auto-scheduler won't touch it
  pinned?: boolean; // If true, manual assignment protected from Smart Fill
}

export interface DailySchedule {
  date: string; // ISO string
  dayOfWeek: WeekDay;
  assignments: Record<string, ScheduleAssignment>; // operatorId -> Assignment
}

export interface WeeklySchedule {
  id: string;
  weekNumber: number;
  year: number;
  status: 'Draft' | 'Published';
  locked: boolean; // If true, schedule cannot be edited
  days: DailySchedule[];
}

export const INITIAL_SKILLS = [
  'Decanting',
  'Troubleshooter',
  'Troubleshooter AD',
  'Quality Checker',
  'MONO Counter',
  'Filler',
  'EST',
  'Platform',
  'LVB Sheet',
  'Exceptions',
  'Exceptions/Station',
  'Training',
  // TC (Coordinator) skills - these should only be assigned to Coordinators
  'Process',
  'People',
  'Off Process',
];

// Skills that are exclusive to Team Coordinators (TC)
export const TC_SKILLS = ['Process', 'People', 'Off Process'];

// Fixed colors for TC tasks - these should NEVER change when applying palettes
// TC tasks need consistent colors for quick visual identification
export const TC_FIXED_COLORS = {
  'Process': '#DFFBE9',      // Light Green (RGB 223, 251, 233)
  'People': '#DFFBE9',       // Light Green (RGB 223, 251, 233)
  'Off Process': '#EBEDF0',  // Light Gray (RGB 235, 237, 240)
} as const;

// Helper to check if a task is a TC task
export function isTCTask(task: TaskType): boolean {
  return TC_SKILLS.includes(task.requiredSkill);
}

// Helper to get fixed TC color for a task (returns undefined if not a TC task)
export function getTCFixedColor(task: TaskType): string | undefined {
  return TC_FIXED_COLORS[task.requiredSkill as keyof typeof TC_FIXED_COLORS];
}

export const MOCK_TASKS: TaskType[] = [
  { id: 't1', name: 'Troubleshooter', color: '#0ea5e9', textColor: '#ffffff', requiredSkill: 'Troubleshooter', requiredOperators: 1 }, // Sky blue
  { id: 't2', name: 'Quality checker', color: '#374151', textColor: '#ffffff', requiredSkill: 'Quality Checker', requiredOperators: 2 }, // Dark Gray - needs 2 people
  { id: 't3', name: 'MONO counter', color: '#fbbf24', textColor: '#000000', requiredSkill: 'MONO Counter', requiredOperators: 1 }, // Amber
  { id: 't4', name: 'Filler', color: '#84cc16', textColor: '#000000', requiredSkill: 'Filler', requiredOperators: 1 }, // Lime
  { id: 't5', name: 'LVB Sheet', color: '#fbbf24', textColor: '#000000', requiredSkill: 'LVB Sheet', requiredOperators: 1 }, // Amber
  { id: 't6', name: 'Decanting', color: '#86efac', textColor: '#000000', requiredSkill: 'Decanting', requiredOperators: 2 }, // Light Green - needs 2 people
  { id: 't7', name: 'Platform', color: '#f472b6', textColor: '#000000', requiredSkill: 'Platform', requiredOperators: 1 }, // Pink
  { id: 't8', name: 'EST', color: '#a78bfa', textColor: '#ffffff', requiredSkill: 'EST', requiredOperators: 1 }, // Purple
  { id: 't9', name: 'Exceptions', color: '#ef4444', textColor: '#ffffff', requiredSkill: 'Exceptions', requiredOperators: 1 }, // Red
  { id: 't15', name: 'Exceptions/Station', color: '#f87171', textColor: '#ffffff', requiredSkill: 'Exceptions/Station', requiredOperators: 2 }, // Light Red - Flex operator task, needs 2
  { id: 't10', name: 'Troubleshooter AD', color: '#f97316', textColor: '#ffffff', requiredSkill: 'Troubleshooter AD', requiredOperators: 1 }, // Orange - Separate skill from regular Troubleshooter
  { id: 't11', name: 'Process', color: '#DFFBE9', textColor: '#000000', requiredSkill: 'Process', requiredOperators: 1, isCoordinatorOnly: true }, // TC - Fixed Light Green (RGB 223, 251, 233)
  { id: 't12', name: 'People', color: '#DFFBE9', textColor: '#000000', requiredSkill: 'People', requiredOperators: 1, isCoordinatorOnly: true }, // TC - Fixed Light Green (RGB 223, 251, 233)
  { id: 't13', name: 'Off process', color: '#EBEDF0', textColor: '#000000', requiredSkill: 'Off Process', requiredOperators: 1, isCoordinatorOnly: true }, // TC - Fixed Light Gray (RGB 235, 237, 240)
];

/**
 * Helper to get required operators for a task on a specific day
 */
export function getRequiredOperatorsForDay(task: TaskType, day: WeekDay): number {
  if (!task.requiredOperators) return 1;
  if (typeof task.requiredOperators === 'number') return task.requiredOperators;
  return task.requiredOperators[day] ?? 1;
}

export const MOCK_OPERATORS: Operator[] = [
  // Regular operators
  { id: 'op1', name: 'Alesja', type: 'Regular', status: 'Active', skills: ['Troubleshooter', 'Quality Checker', 'MONO Counter', 'Filler', 'LVB Sheet'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op2', name: 'Beata', type: 'Regular', status: 'Active', skills: ['Decanting', 'Quality Checker'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op3', name: 'Bruno', type: 'Regular', status: 'Active', skills: ['Platform', 'Troubleshooter', 'EST', 'Quality Checker'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op4', name: 'Erica', type: 'Regular', status: 'Active', skills: ['Decanting'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op5', name: 'Gulhatun', type: 'Regular', status: 'Active', skills: ['LVB Sheet', 'Exceptions', 'MONO Counter', 'Troubleshooter', 'Quality Checker'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op6', name: 'Ionel', type: 'Regular', status: 'Active', skills: ['Quality Checker', 'Troubleshooter', 'Filler', 'Platform', 'EST'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op7', name: 'Irma', type: 'Regular', status: 'Active', skills: ['Troubleshooter', 'Filler', 'Exceptions', 'Quality Checker'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op8', name: 'José', type: 'Regular', status: 'Active', skills: ['Quality Checker', 'Exceptions', 'Troubleshooter'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op9', name: 'Lukasz', type: 'Regular', status: 'Active', skills: ['Exceptions', 'Troubleshooter', 'LVB Sheet', 'Quality Checker', 'MONO Counter'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op12', name: 'Maha', type: 'Regular', status: 'Active', skills: ['Filler', 'LVB Sheet', 'Troubleshooter'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op13', name: 'Mihaela', type: 'Regular', status: 'Active', skills: ['Decanting'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op14', name: 'Monikka', type: 'Regular', status: 'Active', skills: ['Troubleshooter', 'MONO Counter', 'EST'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op15', name: 'Nuno', type: 'Regular', status: 'Active', skills: ['Exceptions', 'Troubleshooter', 'Quality Checker', 'Platform'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op16', name: 'Pedro', type: 'Regular', status: 'Active', skills: ['Troubleshooter', 'MONO Counter', 'Exceptions'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op17', name: 'Susana', type: 'Regular', status: 'Active', skills: ['EST', 'Troubleshooter', 'Quality Checker', 'MONO Counter'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op18', name: 'Sylwia', type: 'Regular', status: 'Active', skills: ['Decanting'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op19', name: 'Zeynep', type: 'Regular', status: 'Active', skills: ['MONO Counter', 'Filler', 'Troubleshooter', 'LVB Sheet', 'Exceptions'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op20', name: 'Yonay', type: 'Regular', status: 'Active', skills: ['Platform', 'Quality Checker', 'Troubleshooter', 'Exceptions'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op21', name: 'Javier', type: 'Regular', status: 'Active', skills: ['MONO Counter', 'EST', 'Platform', 'Troubleshooter'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  // Flex operators
  { id: 'op22', name: 'Flex Op 1', type: 'Flex', status: 'Active', skills: ['Exceptions/Station'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op23', name: 'Flex Op 2', type: 'Flex', status: 'Active', skills: ['Exceptions/Station'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  // Coordinators (Team Coordinators) - each has all 3 TC skills: Process, People, Off Process
  { id: 'op10', name: 'Giedrius', type: 'Coordinator', status: 'Active', skills: ['Process', 'People', 'Off Process'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op11', name: 'Natalia', type: 'Coordinator', status: 'Active', skills: ['People', 'Process', 'Off Process'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
  { id: 'op24', name: 'Floris', type: 'Coordinator', status: 'Active', skills: ['Process', 'People', 'Off Process'], availability: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true } },
];

// ─────────────────────────────────────────────────────────────────
// User Feedback System Types
// ─────────────────────────────────────────────────────────────────

// Feedback categories
export type FeedbackCategory = 'bug' | 'feature' | 'ui-ux' | 'question';

// Feedback priority levels
export type FeedbackPriority = 'low' | 'medium' | 'high';

// Feedback status for tracking
export type FeedbackStatus = 'submitted' | 'in-review' | 'planned' | 'in-progress' | 'completed' | 'declined';

// Individual feedback item
export interface FeedbackItem {
  id: string;
  category: FeedbackCategory;
  title: string;
  description: string;
  priority: FeedbackPriority;
  status: FeedbackStatus;
  contactEmail?: string;  // Optional - for follow-up
  screenshot?: string;    // Base64 encoded image or file path
  screenshotName?: string; // Original filename
  votes: number;          // For voting on suggestions
  createdAt: string;      // ISO date string
  updatedAt: string;      // ISO date string
  // System info captured automatically
  userAgent?: string;
  appVersion?: string;
  currentPage?: string;   // Which page/view they were on
}

// Helper to create a new feedback item
export function createEmptyFeedbackItem(): Omit<FeedbackItem, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    category: 'feature',
    title: '',
    description: '',
    priority: 'medium',
    status: 'submitted',
    votes: 0,
  };
}

// Category metadata for UI
export const FEEDBACK_CATEGORIES: Record<FeedbackCategory, { label: string; icon: string; color: string; description: string }> = {
  bug: {
    label: 'Bug Report',
    icon: 'Bug',
    color: 'red',
    description: 'Something isn\'t working correctly',
  },
  feature: {
    label: 'Feature Request',
    icon: 'Lightbulb',
    color: 'amber',
    description: 'I wish the app could...',
  },
  'ui-ux': {
    label: 'UI/UX Suggestion',
    icon: 'Palette',
    color: 'purple',
    description: 'This could look or feel better',
  },
  question: {
    label: 'Question',
    icon: 'HelpCircle',
    color: 'blue',
    description: 'How do I...?',
  },
};

// Priority metadata for UI
export const FEEDBACK_PRIORITIES: Record<FeedbackPriority, { label: string; color: string }> = {
  low: { label: 'Low', color: 'slate' },
  medium: { label: 'Medium', color: 'amber' },
  high: { label: 'High', color: 'red' },
};

// Status metadata for UI
export const FEEDBACK_STATUSES: Record<FeedbackStatus, { label: string; color: string }> = {
  submitted: { label: 'Submitted', color: 'slate' },
  'in-review': { label: 'In Review', color: 'blue' },
  planned: { label: 'Planned', color: 'purple' },
  'in-progress': { label: 'In Progress', color: 'amber' },
  completed: { label: 'Completed', color: 'emerald' },
  declined: { label: 'Declined', color: 'red' },
};

// ─────────────────────────────────────────────────────────────────
// Local Authentication Types (Demo/Prototype)
// ─────────────────────────────────────────────────────────────────

// User role in the system
export type UserRole = 'team-leader' | 'team-coordinator';

// Demo user stored in IndexedDB
export interface DemoUser {
  id: string;
  username: string;           // Login identifier (e.g., "masterlord")
  displayName: string;        // Shown in UI (e.g., "Master Lord")
  role: UserRole;
  profilePicture?: string;    // Base64 encoded image data
  passwordHash: string;       // SHA-256 hash of password
  createdAt: string;          // ISO date string
  lastLogin?: string;         // ISO date string
  preferences: {
    theme: 'Modern' | 'Midnight';
  };
}

// Session stored in localStorage (survives page refresh)
export interface LocalSession {
  userId: string;
  username: string;
  displayName: string;
  role: UserRole;
  profilePicture?: string;
  loginAt: string;            // ISO date string
  expiresAt: string;          // ISO date string (24h from login)
}

// Auth state for React components
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: DemoUser | null;
  error: string | null;
}

// Helper to get role display text
export function getRoleDisplayText(role: UserRole): string {
  switch (role) {
    case 'team-leader':
      return 'Team Leader';
    case 'team-coordinator':
      return 'Team Coordinator';
    default:
      return role;
  }
}

// Helper to get initials from display name (for avatar fallback)
export function getInitials(displayName: string): string {
  return displayName
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ─────────────────────────────────────────────────────────────────
// Fill Gaps Soft Rules Types
// ─────────────────────────────────────────────────────────────────

// Available soft rule types for Fill Gaps
export type SoftRuleType =
  | 'avoid-consecutive-same-task'    // Avoid same task 2+ days in a row
  | 'task-variety'                    // Try different tasks each day
  | 'workload-balance'                // Prefer operators with fewer assignments
  | 'avoid-consecutive-heavy';        // Avoid 2 heavy tasks in a row (LAST RESORT)

// Individual soft rule configuration
export interface SoftRule {
  id: SoftRuleType;
  enabled: boolean;
  priority: number;  // Lower number = higher priority (1 = first to try, 4 = last resort)
}

// Metadata for soft rules (for UI display)
export const SOFT_RULE_METADATA: Record<SoftRuleType, {
  label: string;
  description: string;
  icon: string;
  defaultPriority: number;
}> = {
  'avoid-consecutive-same-task': {
    label: 'Avoid Consecutive Days',
    description: 'Try not to assign the same task 2+ days in a row',
    icon: 'CalendarX2',
    defaultPriority: 1,
  },
  'task-variety': {
    label: 'Task Variety',
    description: 'Prefer assigning different tasks each day',
    icon: 'Shuffle',
    defaultPriority: 2,
  },
  'workload-balance': {
    label: 'Workload Balance',
    description: 'Prefer operators with fewer total assignments',
    icon: 'Scale',
    defaultPriority: 3,
  },
  'avoid-consecutive-heavy': {
    label: 'Avoid Heavy Task Streaks',
    description: 'Avoid assigning 2 heavy tasks in consecutive days (last resort)',
    icon: 'AlertTriangle',
    defaultPriority: 4,
  },
};

// Default soft rules configuration
export const DEFAULT_SOFT_RULES: SoftRule[] = [
  { id: 'avoid-consecutive-same-task', enabled: true, priority: 1 },
  { id: 'task-variety', enabled: true, priority: 2 },
  { id: 'workload-balance', enabled: true, priority: 3 },
  { id: 'avoid-consecutive-heavy', enabled: true, priority: 4 },
];

// Fill Gaps settings stored in AppSettings
export interface FillGapsSettings {
  softRules: SoftRule[];
}

// Default Fill Gaps settings
export const DEFAULT_FILL_GAPS_SETTINGS: FillGapsSettings = {
  softRules: DEFAULT_SOFT_RULES,
};

// Fill Gaps assignment result with rule violation tracking
export interface FillGapsAssignment {
  day: WeekDay;
  dayIndex: number;
  operatorId: string;
  operatorName: string;
  taskId: string;
  taskName: string;
  taskColor: string;
  // Track which soft rules were broken for this assignment
  brokenRules: SoftRuleType[];
  // True if all soft rules were followed
  followedAllRules: boolean;
}

// Unfillable gap reason
export interface UnfillableGap {
  day: WeekDay;
  operatorId: string;
  operatorName: string;
  reason: string;  // e.g., "No matching skills for any task"
}

// Fill Gaps result structure
export interface FillGapsResult {
  assignments: FillGapsAssignment[];
  unfillableGaps: UnfillableGap[];
  stats: {
    totalEmptyCells: number;
    filledCells: number;
    unfilledCells: number;
    followedAllRules: number;     // Assignments that followed all soft rules
    requiredRelaxing: number;     // Assignments that broke at least one rule
    byDay: Record<WeekDay, number>;
  };
}

// Helper to get soft rules sorted by priority
export function getSortedSoftRules(rules: SoftRule[]): SoftRule[] {
  return [...rules]
    .filter(r => r.enabled)
    .sort((a, b) => a.priority - b.priority);
}

// Helper to check if a rule is enabled
export function isSoftRuleEnabled(rules: SoftRule[], ruleId: SoftRuleType): boolean {
  const rule = rules.find(r => r.id === ruleId);
  return rule?.enabled ?? false;
}

// ─────────────────────────────────────────────────────────────────
// Color Theme System Types
// ─────────────────────────────────────────────────────────────────

// A single color in a palette
export interface PaletteColor {
  hex: string;
  name: string;  // Human-readable name for the color
}

// Color theme/palette definition
export interface ColorTheme {
  id: string;
  name: string;
  description: string;
  type: 'system' | 'custom';  // System palettes are read-only
  colors: PaletteColor[];     // 12 colors per palette
  isAccessible?: boolean;     // Marked if designed for accessibility
}

// Task color storage - supports both palette index and custom hex
export interface TaskColorConfig {
  colorIndex?: number;      // 0-11, references active palette
  customColor?: string;     // Hex value, independent of palette
}

// Recent color entry (for color history)
export interface RecentColor {
  hex: string;
  usedAt: string;  // ISO date string
}

// App appearance settings
export interface AppearanceSettings {
  activeThemeId: string;           // ID of the active color palette
  customThemes: ColorTheme[];      // User-created custom palettes
  recentColors: RecentColor[];     // Last 8 custom colors used (FIFO)
}

// ─────────────────────────────────────────────────────────────────
// Predefined Color Palettes (12 colors each)
// ─────────────────────────────────────────────────────────────────

export const COLOR_PALETTES: ColorTheme[] = [
  {
    id: 'standard',
    name: 'Standard',
    description: 'The default palette with vibrant, distinct colors',
    type: 'system',
    colors: [
      { hex: '#ef4444', name: 'Red' },
      { hex: '#f97316', name: 'Orange' },
      { hex: '#fbbf24', name: 'Amber' },
      { hex: '#84cc16', name: 'Lime' },
      { hex: '#22c55e', name: 'Green' },
      { hex: '#14b8a6', name: 'Teal' },
      { hex: '#0ea5e9', name: 'Sky' },
      { hex: '#6366f1', name: 'Indigo' },
      { hex: '#a78bfa', name: 'Violet' },
      { hex: '#f472b6', name: 'Pink' },
      { hex: '#64748b', name: 'Slate' },
      { hex: '#374151', name: 'Gray' },
    ],
  },
  {
    id: 'high-contrast',
    name: 'High Contrast',
    description: 'Maximum distinction for dense schedules',
    type: 'system',
    colors: [
      { hex: '#dc2626', name: 'Bold Red' },
      { hex: '#ea580c', name: 'Bold Orange' },
      { hex: '#facc15', name: 'Yellow' },
      { hex: '#16a34a', name: 'Bold Green' },
      { hex: '#0891b2', name: 'Cyan' },
      { hex: '#2563eb', name: 'Blue' },
      { hex: '#7c3aed', name: 'Purple' },
      { hex: '#db2777', name: 'Magenta' },
      { hex: '#171717', name: 'Black' },
      { hex: '#737373', name: 'Gray' },
      { hex: '#0d9488', name: 'Teal' },
      { hex: '#be185d', name: 'Rose' },
    ],
  },
  {
    id: 'colorblind-safe',
    name: 'Colorblind Safe',
    description: 'Optimized for color vision deficiency (deuteranopia/protanopia)',
    type: 'system',
    isAccessible: true,
    colors: [
      { hex: '#0077bb', name: 'Blue' },
      { hex: '#33bbee', name: 'Cyan' },
      { hex: '#009988', name: 'Teal' },
      { hex: '#ee7733', name: 'Orange' },
      { hex: '#cc3311', name: 'Vermillion' },
      { hex: '#ee3377', name: 'Magenta' },
      { hex: '#bbbbbb', name: 'Gray' },
      { hex: '#000000', name: 'Black' },
      { hex: '#ffdd00', name: 'Yellow' },
      { hex: '#aa4499', name: 'Purple' },
      { hex: '#44aa99', name: 'Mint' },
      { hex: '#882255', name: 'Wine' },
    ],
  },
  {
    id: 'soft-muted',
    name: 'Soft & Muted',
    description: 'Pastel tones for reduced eye strain during all-day use',
    type: 'system',
    colors: [
      { hex: '#fca5a5', name: 'Soft Red' },
      { hex: '#fdba74', name: 'Soft Orange' },
      { hex: '#fde047', name: 'Soft Yellow' },
      { hex: '#bef264', name: 'Soft Lime' },
      { hex: '#86efac', name: 'Soft Green' },
      { hex: '#5eead4', name: 'Soft Teal' },
      { hex: '#7dd3fc', name: 'Soft Sky' },
      { hex: '#a5b4fc', name: 'Soft Indigo' },
      { hex: '#c4b5fd', name: 'Soft Violet' },
      { hex: '#f9a8d4', name: 'Soft Pink' },
      { hex: '#cbd5e1', name: 'Soft Slate' },
      { hex: '#d1d5db', name: 'Soft Gray' },
    ],
  },
  {
    id: 'industrial',
    name: 'Industrial',
    description: 'Inspired by warehouse safety signage and industrial environments',
    type: 'system',
    colors: [
      { hex: '#dc2626', name: 'Danger Red' },
      { hex: '#f97316', name: 'Warning Orange' },
      { hex: '#facc15', name: 'Caution Yellow' },
      { hex: '#16a34a', name: 'Safety Green' },
      { hex: '#0ea5e9', name: 'Information Blue' },
      { hex: '#7c3aed', name: 'Process Purple' },
      { hex: '#78716c', name: 'Industrial Brown' },
      { hex: '#1e293b', name: 'Dark Navy' },
      { hex: '#f5f5f4', name: 'Light Gray' },
      { hex: '#27272a', name: 'Charcoal' },
      { hex: '#059669', name: 'Emerald' },
      { hex: '#0369a1', name: 'Deep Blue' },
    ],
  },
];

// Default appearance settings
export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  activeThemeId: 'standard',
  customThemes: [],
  recentColors: [],
};

// Helper to get a palette by ID
export function getPaletteById(id: string, customThemes: ColorTheme[] = []): ColorTheme | undefined {
  return COLOR_PALETTES.find(p => p.id === id) || customThemes.find(p => p.id === id);
}

// Helper to get color from palette by index
export function getColorFromPalette(palette: ColorTheme, index: number): string {
  if (index < 0 || index >= palette.colors.length) {
    return palette.colors[0].hex;  // Fallback to first color
  }
  return palette.colors[index].hex;
}

// Helper to resolve task color (handles both index and custom)
export function resolveTaskColor(
  taskColor: TaskColorConfig | undefined,
  palette: ColorTheme,
  fallbackHex: string = '#6366f1'
): string {
  if (!taskColor) return fallbackHex;
  if (taskColor.customColor) return taskColor.customColor;
  if (taskColor.colorIndex !== undefined) {
    return getColorFromPalette(palette, taskColor.colorIndex);
  }
  return fallbackHex;
}

// Helper to find closest palette index for a hex color
export function findClosestPaletteIndex(hex: string, palette: ColorTheme): number {
  const targetRgb = hexToRgb(hex);
  if (!targetRgb) return 0;

  let closestIndex = 0;
  let closestDistance = Infinity;

  palette.colors.forEach((color, index) => {
    const rgb = hexToRgb(color.hex);
    if (rgb) {
      const distance = Math.sqrt(
        Math.pow(targetRgb.r - rgb.r, 2) +
        Math.pow(targetRgb.g - rgb.g, 2) +
        Math.pow(targetRgb.b - rgb.b, 2)
      );
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    }
  });

  return closestIndex;
}

// Helper to convert hex to RGB
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null;
}

// Helper to add a recent color (maintains max 8, FIFO)
export function addRecentColor(recentColors: RecentColor[], hex: string): RecentColor[] {
  // Remove if already exists
  const filtered = recentColors.filter(c => c.hex.toLowerCase() !== hex.toLowerCase());
  // Add to front
  const updated = [{ hex, usedAt: new Date().toISOString() }, ...filtered];
  // Keep only 8
  return updated.slice(0, 8);
}

// Helper to check if a color is in the current palette
export function isColorInPalette(hex: string, palette: ColorTheme): boolean {
  return palette.colors.some(c => c.hex.toLowerCase() === hex.toLowerCase());
}

// Helper to get text color for a background (black or white based on luminance)
export function getContrastTextColor(bgHex: string): string {
  const rgb = hexToRgb(bgHex);
  if (!rgb) return '#ffffff';
  // Calculate relative luminance
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

// ─────────────────────────────────────────────────────────────────
// Delta E Color Difference (WCAG/Perceptual Accessibility)
// ─────────────────────────────────────────────────────────────────

// LAB color space representation
export interface LabColor {
  L: number;  // Lightness (0-100)
  a: number;  // Green-Red axis (-128 to 127)
  b: number;  // Blue-Yellow axis (-128 to 127)
}

// Convert RGB to XYZ color space (intermediate step)
export function rgbToXyz(r: number, g: number, b: number): { x: number; y: number; z: number } {
  // Normalize RGB values to 0-1 range
  let rNorm = r / 255;
  let gNorm = g / 255;
  let bNorm = b / 255;

  // Apply sRGB gamma correction
  rNorm = rNorm > 0.04045 ? Math.pow((rNorm + 0.055) / 1.055, 2.4) : rNorm / 12.92;
  gNorm = gNorm > 0.04045 ? Math.pow((gNorm + 0.055) / 1.055, 2.4) : gNorm / 12.92;
  bNorm = bNorm > 0.04045 ? Math.pow((bNorm + 0.055) / 1.055, 2.4) : bNorm / 12.92;

  // Scale to 0-100
  rNorm *= 100;
  gNorm *= 100;
  bNorm *= 100;

  // Convert to XYZ using sRGB D65 illuminant matrix
  return {
    x: rNorm * 0.4124564 + gNorm * 0.3575761 + bNorm * 0.1804375,
    y: rNorm * 0.2126729 + gNorm * 0.7151522 + bNorm * 0.0721750,
    z: rNorm * 0.0193339 + gNorm * 0.1191920 + bNorm * 0.9503041,
  };
}

// Convert XYZ to LAB color space
export function xyzToLab(x: number, y: number, z: number): LabColor {
  // D65 illuminant reference values
  const refX = 95.047;
  const refY = 100.000;
  const refZ = 108.883;

  let xNorm = x / refX;
  let yNorm = y / refY;
  let zNorm = z / refZ;

  // Apply LAB transform
  const epsilon = 0.008856;
  const kappa = 903.3;

  xNorm = xNorm > epsilon ? Math.pow(xNorm, 1/3) : (kappa * xNorm + 16) / 116;
  yNorm = yNorm > epsilon ? Math.pow(yNorm, 1/3) : (kappa * yNorm + 16) / 116;
  zNorm = zNorm > epsilon ? Math.pow(zNorm, 1/3) : (kappa * zNorm + 16) / 116;

  return {
    L: 116 * yNorm - 16,
    a: 500 * (xNorm - yNorm),
    b: 200 * (yNorm - zNorm),
  };
}

// Convert hex color to LAB
export function hexToLab(hex: string): LabColor | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const xyz = rgbToXyz(rgb.r, rgb.g, rgb.b);
  return xyzToLab(xyz.x, xyz.y, xyz.z);
}

// Calculate Delta E (CIE76) between two LAB colors
// Delta E values interpretation:
// 0-1: Not perceptible by human eyes
// 1-2: Perceptible through close observation
// 2-10: Perceptible at a glance
// 11-49: Colors are more similar than opposite
// 50-100: Colors are exact opposite
// For accessibility, we want ≥ 25 for easy distinction
export function calculateDeltaE(lab1: LabColor, lab2: LabColor): number {
  return Math.sqrt(
    Math.pow(lab2.L - lab1.L, 2) +
    Math.pow(lab2.a - lab1.a, 2) +
    Math.pow(lab2.b - lab1.b, 2)
  );
}

// Calculate Delta E between two hex colors
export function calculateDeltaEHex(hex1: string, hex2: string): number {
  const lab1 = hexToLab(hex1);
  const lab2 = hexToLab(hex2);
  if (!lab1 || !lab2) return 0;
  return calculateDeltaE(lab1, lab2);
}

// Minimum Delta E threshold for accessible color distinction
export const MIN_DELTA_E_THRESHOLD = 25;

// Check if a color has sufficient Delta E from all colors in a set
export function hasMinimumDeltaE(hex: string, existingColors: string[], minDeltaE: number = MIN_DELTA_E_THRESHOLD): boolean {
  const lab = hexToLab(hex);
  if (!lab) return false;

  for (const existingHex of existingColors) {
    const existingLab = hexToLab(existingHex);
    if (existingLab && calculateDeltaE(lab, existingLab) < minDeltaE) {
      return false;
    }
  }
  return true;
}

// Find colors in a palette that have minimum Delta E from existing assigned colors
export function findAccessiblePaletteColors(
  palette: ColorTheme,
  assignedColors: string[],
  minDeltaE: number = MIN_DELTA_E_THRESHOLD
): number[] {
  const accessibleIndices: number[] = [];

  for (let i = 0; i < palette.colors.length; i++) {
    const colorHex = palette.colors[i].hex;
    if (hasMinimumDeltaE(colorHex, assignedColors, minDeltaE)) {
      accessibleIndices.push(i);
    }
  }

  return accessibleIndices;
}

// Sort palette indices by Delta E from a reference color (furthest first)
export function sortByDeltaEFromColor(
  palette: ColorTheme,
  referenceHex: string,
  indices: number[]
): number[] {
  const refLab = hexToLab(referenceHex);
  if (!refLab) return indices;

  return [...indices].sort((a, b) => {
    const labA = hexToLab(palette.colors[a].hex);
    const labB = hexToLab(palette.colors[b].hex);
    if (!labA || !labB) return 0;
    const deltaA = calculateDeltaE(refLab, labA);
    const deltaB = calculateDeltaE(refLab, labB);
    return deltaB - deltaA; // Descending (furthest first)
  });
}
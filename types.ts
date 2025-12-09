export type WeekDay = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri';

export interface TaskType {
  id: string;
  name: string;
  color: string; // Tailwind class mostly, or hex
  textColor: string;
  requiredSkill: string;
  // Number of operators required per day (defaults to 1 if not specified)
  // Can be a single number for all days or per-day configuration
  requiredOperators?: number | Record<WeekDay, number>;
}

export interface Operator {
  id: string;
  name: string;
  skills: string[];
  type: 'Regular' | 'Flex' | 'Coordinator';
  status: 'Active' | 'Sick' | 'Leave';
  // Simple availability: true if available that day
  availability: Record<WeekDay, boolean>;
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
  { id: 't10', name: 'Troubleshooter AD', color: '#f97316', textColor: '#ffffff', requiredSkill: 'Troubleshooter', requiredOperators: 1 }, // Orange
  { id: 't11', name: 'Process', color: '#dcfce7', textColor: '#000000', requiredSkill: 'Process', requiredOperators: 1 }, // Pale Green
  { id: 't12', name: 'People', color: '#dcfce7', textColor: '#000000', requiredSkill: 'People', requiredOperators: 1 }, // Pale Green
  { id: 't13', name: 'Off process', color: '#e5e7eb', textColor: '#000000', requiredSkill: 'Off Process', requiredOperators: 1 }, // Gray - requires Off Process skill
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
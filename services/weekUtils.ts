import { WeekDay, DailySchedule, WeeklySchedule } from '../types';

/**
 * Get the ISO week number for a given date
 */
export function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Get the Monday of the week containing the given date
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format date for display (e.g., "Dec 9")
 */
export function formatDateShort(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Get the date range string for a week (e.g., "Dec 9 - 13")
 */
export function getWeekRangeString(weekStart: Date): string {
  const friday = new Date(weekStart);
  friday.setDate(friday.getDate() + 4);

  const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = friday.toLocaleDateString('en-US', { month: 'short' });

  if (startMonth === endMonth) {
    return `${startMonth} ${weekStart.getDate()} - ${friday.getDate()}`;
  }
  return `${startMonth} ${weekStart.getDate()} - ${endMonth} ${friday.getDate()}`;
}

/**
 * Create an empty week schedule for a given date
 */
export function createEmptyWeek(referenceDate: Date): WeeklySchedule {
  const weekStart = getWeekStart(referenceDate);
  const weekNumber = getISOWeekNumber(weekStart);
  const year = weekStart.getFullYear();

  const days: DailySchedule[] = [];
  const dayNames: WeekDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  for (let i = 0; i < 5; i++) {
    const dayDate = new Date(weekStart);
    dayDate.setDate(weekStart.getDate() + i);

    days.push({
      date: formatDateISO(dayDate),
      dayOfWeek: dayNames[i],
      assignments: {}
    });
  }

  return {
    id: `w${weekNumber}-${year}`,
    weekNumber,
    year,
    status: 'Draft',
    locked: false,
    days
  };
}

/**
 * Get week for navigation (previous or next)
 */
export function getAdjacentWeek(currentWeek: WeeklySchedule, direction: 'prev' | 'next'): WeeklySchedule {
  // Parse the first day of current week
  const currentStart = new Date(currentWeek.days[0].date);

  // Add or subtract 7 days
  const newStart = new Date(currentStart);
  newStart.setDate(newStart.getDate() + (direction === 'next' ? 7 : -7));

  return createEmptyWeek(newStart);
}

/**
 * Get week ID from a date
 */
export function getWeekId(date: Date): string {
  const weekStart = getWeekStart(date);
  const weekNumber = getISOWeekNumber(weekStart);
  const year = weekStart.getFullYear();
  return `w${weekNumber}-${year}`;
}

/**
 * Check if two weeks are the same
 */
export function isSameWeek(week1: WeeklySchedule, week2: WeeklySchedule): boolean {
  return week1.id === week2.id;
}

/**
 * Check if a week is the current week
 */
export function isCurrentWeek(week: WeeklySchedule): boolean {
  const today = new Date();
  const currentWeekId = getWeekId(today);
  return week.id === currentWeekId;
}

/**
 * Get display label for week (e.g., "Week 50, 2024")
 */
export function getWeekLabel(week: WeeklySchedule): string {
  return `Week ${week.weekNumber}, ${week.year}`;
}

import { Operator, TaskType, WeeklySchedule } from '../types';

export type ActivityType =
  | 'schedule_generated'
  | 'schedule_published'
  | 'schedule_unpublished'
  | 'schedule_locked'
  | 'schedule_unlocked'
  | 'assignment_changed'
  | 'operator_added'
  | 'operator_updated'
  | 'operator_status_changed'
  | 'task_updated';

export interface ActivityLogEntry {
  id: string;
  type: ActivityType;
  timestamp: Date;
  description: string;
  details?: {
    operatorName?: string;
    operatorId?: string;
    taskName?: string;
    taskId?: string;
    weekLabel?: string;
    oldValue?: string;
    newValue?: string;
    day?: string;
  };
}

// In-memory store (will persist to localStorage)
const STORAGE_KEY = 'lotb_activity_log';
const MAX_ENTRIES = 100;

/**
 * Load activity log from localStorage
 */
export function loadActivityLog(): ActivityLogEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const entries = JSON.parse(stored);
      // Convert timestamp strings back to Date objects
      return entries.map((e: ActivityLogEntry) => ({
        ...e,
        timestamp: new Date(e.timestamp)
      }));
    }
  } catch (e) {
    console.error('Failed to load activity log:', e);
  }
  return [];
}

/**
 * Save activity log to localStorage
 */
function saveActivityLog(entries: ActivityLogEntry[]): void {
  try {
    // Keep only the most recent entries
    const trimmed = entries.slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('Failed to save activity log:', e);
  }
}

/**
 * Add a new activity log entry
 */
export function logActivity(
  type: ActivityType,
  description: string,
  details?: ActivityLogEntry['details']
): ActivityLogEntry {
  const entry: ActivityLogEntry = {
    id: crypto.randomUUID(),
    type,
    timestamp: new Date(),
    description,
    details
  };

  const entries = loadActivityLog();
  entries.unshift(entry); // Add to beginning
  saveActivityLog(entries);

  return entry;
}

/**
 * Log schedule generation
 */
export function logScheduleGenerated(weekLabel: string, assignmentCount: number): ActivityLogEntry {
  return logActivity(
    'schedule_generated',
    `Auto-filled ${assignmentCount} slots`,
    { weekLabel }
  );
}

/**
 * Log schedule publish
 */
export function logSchedulePublished(weekLabel: string, locked: boolean): ActivityLogEntry {
  return logActivity(
    'schedule_published',
    `Published schedule${locked ? ' (locked)' : ''}`,
    { weekLabel }
  );
}

/**
 * Log schedule unpublish
 */
export function logScheduleUnpublished(weekLabel: string): ActivityLogEntry {
  return logActivity(
    'schedule_unpublished',
    'Unpublished schedule',
    { weekLabel }
  );
}

/**
 * Log schedule lock/unlock
 */
export function logScheduleLockToggle(weekLabel: string, locked: boolean): ActivityLogEntry {
  return logActivity(
    locked ? 'schedule_locked' : 'schedule_unlocked',
    locked ? 'Locked schedule' : 'Unlocked schedule',
    { weekLabel }
  );
}

/**
 * Log assignment change
 */
export function logAssignmentChange(
  operatorName: string,
  day: string,
  oldTaskName: string | null,
  newTaskName: string | null
): ActivityLogEntry {
  const action = !newTaskName
    ? `removed from ${oldTaskName}`
    : !oldTaskName
    ? `assigned to ${newTaskName}`
    : `moved from ${oldTaskName} to ${newTaskName}`;

  return logActivity(
    'assignment_changed',
    `${operatorName} ${action} on ${day}`,
    {
      operatorName,
      day,
      oldValue: oldTaskName || undefined,
      newValue: newTaskName || undefined
    }
  );
}

/**
 * Log operator added
 */
export function logOperatorAdded(operatorName: string): ActivityLogEntry {
  return logActivity(
    'operator_added',
    `Added new team member: ${operatorName}`,
    { operatorName }
  );
}

/**
 * Log operator updated
 */
export function logOperatorUpdated(operatorName: string, changes: string): ActivityLogEntry {
  return logActivity(
    'operator_updated',
    `Updated ${operatorName}: ${changes}`,
    { operatorName }
  );
}

/**
 * Log operator status change
 */
export function logOperatorStatusChange(
  operatorName: string,
  oldStatus: string,
  newStatus: string
): ActivityLogEntry {
  return logActivity(
    'operator_status_changed',
    `${operatorName} status changed to ${newStatus}`,
    { operatorName, oldValue: oldStatus, newValue: newStatus }
  );
}

/**
 * Get relative time string (e.g., "2m ago", "1h ago")
 */
export function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Get icon name for activity type
 */
export function getActivityIcon(type: ActivityType): string {
  switch (type) {
    case 'schedule_generated': return 'Sparkles';
    case 'schedule_published': return 'Send';
    case 'schedule_unpublished': return 'Undo';
    case 'schedule_locked': return 'Lock';
    case 'schedule_unlocked': return 'Unlock';
    case 'assignment_changed': return 'ArrowRight';
    case 'operator_added': return 'UserPlus';
    case 'operator_updated': return 'UserCheck';
    case 'operator_status_changed': return 'Activity';
    case 'task_updated': return 'Settings';
    default: return 'Bell';
  }
}

/**
 * Clear all activity logs
 */
export function clearActivityLog(): void {
  localStorage.removeItem(STORAGE_KEY);
}

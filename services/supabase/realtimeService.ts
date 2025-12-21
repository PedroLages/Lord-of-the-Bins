/**
 * Realtime Service - Lord of the Bins
 *
 * Handles real-time subscriptions for collaborative features:
 * - Schedule changes from other users
 * - Operator updates
 * - Task updates
 * - Presence (who's online)
 */

import { getSupabaseClient, isSupabaseConfigured } from './client';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { Operator, TaskType, WeeklySchedule } from '../../types';

// Event types
export type RealtimeEvent =
  | { type: 'schedule_updated'; schedule: Partial<WeeklySchedule> }
  | { type: 'operator_updated'; operator: Partial<Operator> }
  | { type: 'operator_deleted'; operatorId: string }
  | { type: 'task_updated'; task: Partial<TaskType> }
  | { type: 'task_deleted'; taskId: string }
  | { type: 'presence_sync'; users: OnlineUser[] };

export interface OnlineUser {
  id: string;
  displayName: string;
  role: string;
  lastSeen: Date;
}

// Callback types
type EventCallback = (event: RealtimeEvent) => void;

// Active subscriptions
let scheduleChannel: RealtimeChannel | null = null;
let operatorsChannel: RealtimeChannel | null = null;
let tasksChannel: RealtimeChannel | null = null;
let presenceChannel: RealtimeChannel | null = null;

// Event listeners
const listeners: Set<EventCallback> = new Set();

/**
 * Subscribe to real-time events
 */
export function subscribeToRealtimeEvents(callback: EventCallback): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Emit an event to all listeners
 */
function emit(event: RealtimeEvent) {
  listeners.forEach((callback) => {
    try {
      callback(event);
    } catch (error) {
      console.error('[Realtime] Error in event callback:', error);
    }
  });
}

/**
 * Subscribe to schedule changes for a specific week
 */
export function subscribeToSchedule(weekStartDate: string): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  // Unsubscribe from previous schedule subscription
  if (scheduleChannel) {
    supabase.removeChannel(scheduleChannel);
  }

  scheduleChannel = supabase
    .channel(`schedule-${weekStartDate}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'schedules',
        filter: `week_start_date=eq.${weekStartDate}`,
      },
      (payload: RealtimePostgresChangesPayload<any>) => {
        console.log('[Realtime] Schedule change:', payload.eventType);

        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          emit({
            type: 'schedule_updated',
            schedule: {
              id: payload.new.local_id || payload.new.id,
              weekStartDate: payload.new.week_start_date,
              weekLabel: payload.new.week_label,
              status: payload.new.status,
              locked: payload.new.locked,
              days: payload.new.assignments,
            },
          });
        }
      }
    )
    .subscribe((status) => {
      console.log('[Realtime] Schedule subscription status:', status);
    });

  return () => {
    if (scheduleChannel) {
      supabase.removeChannel(scheduleChannel);
      scheduleChannel = null;
    }
  };
}

/**
 * Subscribe to operator changes
 */
export function subscribeToOperators(): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  if (operatorsChannel) {
    supabase.removeChannel(operatorsChannel);
  }

  operatorsChannel = supabase
    .channel('operators-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'operators',
      },
      (payload: RealtimePostgresChangesPayload<any>) => {
        console.log('[Realtime] Operator change:', payload.eventType);

        if (payload.eventType === 'DELETE') {
          emit({
            type: 'operator_deleted',
            operatorId: payload.old.local_id || payload.old.id,
          });
        } else {
          emit({
            type: 'operator_updated',
            operator: {
              id: payload.new.local_id || payload.new.id,
              name: payload.new.name,
              type: payload.new.type,
              status: payload.new.status,
              skills: payload.new.skills,
              availability: payload.new.availability,
              preferredTasks: payload.new.preferred_tasks,
            },
          });
        }
      }
    )
    .subscribe((status) => {
      console.log('[Realtime] Operators subscription status:', status);
    });

  return () => {
    if (operatorsChannel) {
      supabase.removeChannel(operatorsChannel);
      operatorsChannel = null;
    }
  };
}

/**
 * Subscribe to task changes
 */
export function subscribeToTasks(): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  if (tasksChannel) {
    supabase.removeChannel(tasksChannel);
  }

  tasksChannel = supabase
    .channel('tasks-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tasks',
      },
      (payload: RealtimePostgresChangesPayload<any>) => {
        console.log('[Realtime] Task change:', payload.eventType);

        if (payload.eventType === 'DELETE') {
          emit({
            type: 'task_deleted',
            taskId: payload.old.local_id || payload.old.id,
          });
        } else {
          emit({
            type: 'task_updated',
            task: {
              id: payload.new.local_id || payload.new.id,
              name: payload.new.name,
              requiredSkill: payload.new.required_skill,
              color: payload.new.color,
              textColor: payload.new.text_color,
              isHeavy: payload.new.is_heavy,
              isCoordinatorOnly: payload.new.is_coordinator_only,
            },
          });
        }
      }
    )
    .subscribe((status) => {
      console.log('[Realtime] Tasks subscription status:', status);
    });

  return () => {
    if (tasksChannel) {
      supabase.removeChannel(tasksChannel);
      tasksChannel = null;
    }
  };
}

/**
 * Subscribe to presence (who's online)
 */
export function subscribeToPresence(
  userId: string,
  displayName: string,
  role: string
): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  if (presenceChannel) {
    supabase.removeChannel(presenceChannel);
  }

  presenceChannel = supabase
    .channel('online-users')
    .on('presence', { event: 'sync' }, () => {
      const state = presenceChannel?.presenceState() || {};

      const users: OnlineUser[] = Object.entries(state).flatMap(([key, presences]) =>
        (presences as any[]).map((p) => ({
          id: p.user_id,
          displayName: p.display_name,
          role: p.role,
          lastSeen: new Date(p.last_seen),
        }))
      );

      emit({ type: 'presence_sync', users });
    })
    .subscribe(async (status) => {
      console.log('[Realtime] Presence subscription status:', status);

      if (status === 'SUBSCRIBED') {
        // Track this user's presence
        await presenceChannel?.track({
          user_id: userId,
          display_name: displayName,
          role,
          last_seen: new Date().toISOString(),
        });
      }
    });

  // Update presence periodically
  const interval = setInterval(async () => {
    if (presenceChannel) {
      await presenceChannel.track({
        user_id: userId,
        display_name: displayName,
        role,
        last_seen: new Date().toISOString(),
      });
    }
  }, 30000); // Every 30 seconds

  return () => {
    clearInterval(interval);
    if (presenceChannel) {
      supabase.removeChannel(presenceChannel);
      presenceChannel = null;
    }
  };
}

/**
 * Subscribe to all changes (convenience function)
 */
export function subscribeToAllChanges(
  weekStartDate: string,
  userId: string,
  displayName: string,
  role: string
): () => void {
  const unsubSchedule = subscribeToSchedule(weekStartDate);
  const unsubOperators = subscribeToOperators();
  const unsubTasks = subscribeToTasks();
  const unsubPresence = subscribeToPresence(userId, displayName, role);

  return () => {
    unsubSchedule();
    unsubOperators();
    unsubTasks();
    unsubPresence();
  };
}

/**
 * Unsubscribe from all channels
 */
export function unsubscribeAll(): void {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  if (scheduleChannel) {
    supabase.removeChannel(scheduleChannel);
    scheduleChannel = null;
  }
  if (operatorsChannel) {
    supabase.removeChannel(operatorsChannel);
    operatorsChannel = null;
  }
  if (tasksChannel) {
    supabase.removeChannel(tasksChannel);
    tasksChannel = null;
  }
  if (presenceChannel) {
    supabase.removeChannel(presenceChannel);
    presenceChannel = null;
  }

  listeners.clear();
}

/**
 * Check if realtime is available
 */
export function isRealtimeAvailable(): boolean {
  return isSupabaseConfigured && getSupabaseClient() !== null;
}

/**
 * Supabase Client - Lord of the Bins
 *
 * Provides a singleton Supabase client for cloud sync and authentication.
 * The app works without Supabase (local IndexedDB only) if credentials aren't set.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Track whether Supabase is available
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Create client only if configured
let supabaseClient: SupabaseClient<Database> | null = null;

if (isSupabaseConfigured) {
  supabaseClient = createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: localStorage,
      storageKey: 'lotb-auth-token',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
    global: {
      headers: {
        'x-application-name': 'lord-of-the-bins',
      },
    },
  });

  console.log('[Supabase] Client initialized successfully');
} else {
  console.log('[Supabase] Not configured - running in local-only mode');
  console.log('[Supabase] Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable cloud sync');
}

/**
 * Get the Supabase client
 * Returns null if Supabase is not configured
 */
export function getSupabaseClient(): SupabaseClient<Database> | null {
  return supabaseClient;
}

/**
 * Get the Supabase client or throw if not configured
 * Use this when Supabase is required
 */
export function requireSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseClient) {
    throw new Error('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return supabaseClient;
}

/**
 * Check if we're currently connected to Supabase
 */
export async function isSupabaseConnected(): Promise<boolean> {
  if (!supabaseClient) return false;

  try {
    // Simple health check - try to get the current user
    const { error } = await supabaseClient.auth.getSession();
    return !error;
  } catch {
    return false;
  }
}

// Export for convenience
export const supabase = supabaseClient;

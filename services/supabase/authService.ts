/**
 * Supabase Auth Service - Lord of the Bins
 *
 * Handles authentication with support for:
 * - User codes (EMP001) converted to internal emails
 * - Direct email login
 * - Offline cached sessions
 */

import { requireSupabaseClient, getSupabaseClient, isSupabaseConfigured } from './client';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';
import type { DbUser, UpdateTables } from './types';

// App user type (maps to users table)
export interface CloudUser {
  id: string;
  userCode: string;
  email: string | null;
  displayName: string;
  role: 'Team Leader' | 'TC';
  shiftId: string;
  shiftName: string;
  preferences?: {
    theme?: string;
    colorPalette?: string;
    profilePicture?: string;
  };
}

// Internal email domain for user code authentication
const INTERNAL_EMAIL_DOMAIN = 'lotb.internal';

// Session cache key
const SESSION_CACHE_KEY = 'lotb_cached_session';
const USER_CACHE_KEY = 'lotb_cached_user';

/**
 * Convert user code to internal email
 * EMP001 -> emp001@lotb.internal
 */
function userCodeToEmail(userCode: string): string {
  return `${userCode.toLowerCase()}@${INTERNAL_EMAIL_DOMAIN}`;
}

/**
 * Check if input is an email address
 */
function isEmail(input: string): boolean {
  return input.includes('@') && !input.endsWith(`@${INTERNAL_EMAIL_DOMAIN}`);
}

/**
 * Sign in with user code or email
 */
export async function signIn(
  identifier: string,
  password: string
): Promise<CloudUser> {
  const supabase = requireSupabaseClient();

  // Determine if this is an email or user code
  const email = isEmail(identifier) ? identifier : userCodeToEmail(identifier);

  if (!supabase) {
    throw new Error('Supabase is not configured. Please check your environment variables.');
  }

  try {
    // Sign in with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      throw new Error(authError.message);
    }

    if (!authData.user) {
      throw new Error('No user returned from authentication');
    }

    // Fetch user profile from users table
    const { data, error: profileError } = await supabase
      .from('users')
      .select(`
        *,
        shifts:shift_id (name)
      `)
      .eq('id', authData.user.id)
      .single();

    if (profileError || !data) {
      throw new Error(
        profileError
          ? `Failed to fetch user profile: ${profileError.message}`
          : 'User profile not found'
      );
    }

    // Type assertion to help TypeScript understand the query result
    const profile = data as DbUser & { shifts: { name: string } | null };

    const user: CloudUser = {
      id: profile.id,
      userCode: profile.user_code,
      email: profile.email,
      displayName: profile.display_name,
      role: profile.role,
      shiftId: profile.shift_id,
      shiftName: profile.shifts?.name || 'Unknown Shift',
      preferences: profile.preferences as any,
    };

    // Cache session and user for offline access
    cacheSession(authData.session, user);

    return user;
  } catch (error) {
    throw error;
  }
}

/**
 * Sign up a new user
 */
export async function signUp(
  userCode: string,
  password: string,
  displayName: string,
  role: 'Team Leader' | 'TC',
  shiftId: string,
  email?: string
): Promise<CloudUser> {
  const supabase = requireSupabaseClient();

  const internalEmail = userCodeToEmail(userCode);

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: internalEmail,
    password,
  });

  if (authError) {
    throw new Error(authError.message);
  }

  if (!authData.user) {
    throw new Error('Failed to create user');
  }

  // Create profile in users table
  const userData = {
    id: authData.user.id,
    user_code: userCode,
    email: email || null,
    display_name: displayName,
    role,
    shift_id: shiftId,
    preferences: {},
  };

  const { error: profileError } = await supabase.from('users').insert(userData as any);

  if (profileError) {
    // Note: Can't clean up auth user from client-side (admin API requires service role key)
    throw new Error(`Failed to create user profile: ${profileError.message}`);
  }

  return {
    id: authData.user.id,
    userCode,
    email: email || null,
    displayName,
    role,
    shiftId,
    shiftName: 'Pending', // Will be fetched on next login
    preferences: {},
  };
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<void> {
  const supabase = getSupabaseClient();

  if (supabase) {
    await supabase.auth.signOut();
  }

  // Clear cached session
  clearCachedSession();
}

/**
 * Get the currently authenticated user
 */
export async function getCurrentUser(): Promise<CloudUser | null> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    // Return cached user if offline
    const cached = getCachedSession();
    return cached?.user || null;
  }

  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    // Try cached session
    const cached = getCachedSession();
    return cached?.user || null;
  }

  // Fetch profile
  const { data, error } = await supabase
    .from('users')
    .select(`
      *,
      shifts:shift_id (name)
    `)
    .eq('id', authUser.id)
    .single();

  if (error || !data) {
    return null;
  }

  // Type assertion to help TypeScript understand the query result
  const profile = data as DbUser & { shifts: { name: string } | null };

  return {
    id: profile.id,
    userCode: profile.user_code,
    email: profile.email,
    displayName: profile.display_name,
    role: profile.role,
    shiftId: profile.shift_id,
    shiftName: profile.shifts?.name || 'Unknown Shift',
    preferences: profile.preferences as any,
  };
}

/**
 * Subscribe to auth state changes
 */
export function onAuthStateChange(
  callback: (user: CloudUser | null) => void
): () => void {
  const supabase = getSupabaseClient();

  if (!supabase) {
    // No supabase, just return cached user once
    const cached = getCachedSession();
    callback(cached?.user || null);
    return () => {};
  }

  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        clearCachedSession();
        callback(null);
        return;
      }

      // Fetch user profile
      const user = await getCurrentUser();
      callback(user);
    }
  );

  return () => subscription.unsubscribe();
}

/**
 * Update user password
 */
export async function updatePassword(currentPassword: string, newPassword: string): Promise<void> {
  const supabase = requireSupabaseClient();

  // Get current user
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser || !authUser.email) {
    throw new Error('Not authenticated');
  }

  // Verify current password by attempting to sign in
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: authUser.email,
    password: currentPassword,
  });

  if (verifyError) {
    throw new Error('Current password is incorrect');
  }

  // Update to new password
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Update user profile
 */
export async function updateProfile(updates: {
  displayName?: string;
  email?: string;
  preferences?: any;
}): Promise<void> {
  const supabase = requireSupabaseClient();

  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    throw new Error('Not authenticated');
  }

  // Build update data with only provided fields
  const updateData: Record<string, any> = {};
  if (updates.displayName !== undefined) updateData.display_name = updates.displayName;
  if (updates.email !== undefined) updateData.email = updates.email;
  if (updates.preferences !== undefined) updateData.preferences = updates.preferences;

  // Type assertion needed due to Supabase generated type limitations
  const { error } = await (supabase.from('users').update as any)(updateData).eq('id', authUser.id);

  if (error) {
    throw new Error(error.message);
  }

  // Refresh the cached session with updated user data
  try {
    const updatedUser = await getCurrentUser();
    if (updatedUser) {
      const { data: { session } } = await supabase.auth.getSession();
      cacheSession(session, updatedUser);
    }
  } catch (cacheError) {
    console.warn('[Auth] Failed to update cache after profile update:', cacheError);
    // Don't throw - the update succeeded, cache refresh is secondary
  }
}

// ============================================
// SESSION CACHING
// ============================================

interface CachedSession {
  session: Session | null;
  user: CloudUser | null;
  cachedAt: number;
}

function cacheSession(session: Session | null, user: CloudUser | null): void {
  try {
    const cached: CachedSession = {
      session,
      user,
      cachedAt: Date.now(),
    };
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(cached));
  } catch (error) {
    console.error('[Auth] Failed to cache session:', error);
  }
}

function getCachedSession(): CachedSession | null {
  try {
    const cached = localStorage.getItem(SESSION_CACHE_KEY);
    if (!cached) return null;

    const parsed: CachedSession = JSON.parse(cached);

    // Check if cache is expired (24 hours)
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (Date.now() - parsed.cachedAt > maxAge) {
      clearCachedSession();
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('[Auth] Failed to get cached session:', error);
    return null;
  }
}

function clearCachedSession(): void {
  try {
    localStorage.removeItem(SESSION_CACHE_KEY);
    localStorage.removeItem(USER_CACHE_KEY);
  } catch (error) {
    console.error('[Auth] Failed to clear cached session:', error);
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get cached user for instant load (no network calls)
 * Returns null if no cached user or cache expired
 */
export function getCachedUser(): CloudUser | null {
  const cached = getCachedSession();
  return cached?.user || null;
}

/**
 * Check if Supabase auth is available
 */
export function isCloudAuthAvailable(): boolean {
  return isSupabaseConfigured && getSupabaseClient() !== null;
}

/**
 * Get available shifts (for registration)
 */
export async function getShifts(): Promise<{ id: string; name: string }[]> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    // Return default shifts for local mode
    return [
      { id: 'shift-a', name: 'Shift A' },
      { id: 'shift-b', name: 'Shift B' },
    ];
  }

  const { data, error } = await supabase.from('shifts').select('id, name');

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Update shift name (Team Leaders only)
 */
export async function updateShiftName(shiftId: string, newName: string): Promise<void> {
  const supabase = requireSupabaseClient();

  // Validate input
  if (!newName.trim()) {
    throw new Error('Shift name cannot be empty');
  }

  if (newName.length > 50) {
    throw new Error('Shift name must be 50 characters or less');
  }

  // Update shift name
  // Type assertion needed due to Supabase generated type limitations
  const { error } = await (supabase.from('shifts').update as any)({ name: newName.trim() }).eq('id', shiftId);

  if (error) {
    if (error.code === '23505') {
      throw new Error('A shift with this name already exists');
    }
    throw new Error(error.message);
  }
}

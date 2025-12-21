/**
 * Supabase Auth Service - Lord of the Bins
 *
 * Handles authentication with support for:
 * - User codes (EMP001) converted to internal emails
 * - Direct email login
 * - Offline cached sessions
 */

import { getSupabaseClient, isSupabaseConfigured } from './client';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';

// App user type (maps to users table)
export interface CloudUser {
  id: string;
  userCode: string;
  email: string | null;
  displayName: string;
  role: 'Team Leader' | 'TC';
  shiftId: string;
  shiftName: string;
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
  const supabase = getSupabaseClient();

  // Determine if this is an email or user code
  const email = isEmail(identifier) ? identifier : userCodeToEmail(identifier);

  if (!supabase) {
    // Try offline login with cached credentials
    return signInOffline(identifier, password);
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
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select(`
        *,
        shifts:shift_id (name)
      `)
      .eq('id', authData.user.id)
      .single();

    if (profileError) {
      throw new Error(`Failed to fetch user profile: ${profileError.message}`);
    }

    const user: CloudUser = {
      id: profile.id,
      userCode: profile.user_code,
      email: profile.email,
      displayName: profile.display_name,
      role: profile.role,
      shiftId: profile.shift_id,
      shiftName: (profile.shifts as any)?.name || 'Unknown Shift',
    };

    // Cache session and user for offline access
    cacheSession(authData.session, user);

    return user;
  } catch (error) {
    // If network error, try offline login
    if (error instanceof Error && error.message.includes('network')) {
      return signInOffline(identifier, password);
    }
    throw error;
  }
}

/**
 * Sign in using cached credentials (offline mode)
 */
async function signInOffline(identifier: string, password: string): Promise<CloudUser> {
  const cached = getCachedSession();

  if (!cached || !cached.user) {
    throw new Error('No cached session. Please connect to the internet to sign in.');
  }

  // Verify the identifier matches
  const matchesUserCode = cached.user.userCode.toLowerCase() === identifier.toLowerCase();
  const matchesEmail = cached.user.email?.toLowerCase() === identifier.toLowerCase();

  if (!matchesUserCode && !matchesEmail) {
    throw new Error('Cached session is for a different user');
  }

  // Note: We can't verify the password offline without storing it (security risk)
  // Just return the cached user
  console.log('[Auth] Using cached session (offline mode)');

  return cached.user;
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
  const supabase = getSupabaseClient();

  if (!supabase) {
    throw new Error('Cannot sign up in offline mode');
  }

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
  const { error: profileError } = await supabase.from('users').insert({
    id: authData.user.id,
    user_code: userCode,
    email: email || null,
    display_name: displayName,
    role,
    shift_id: shiftId,
  });

  if (profileError) {
    // Try to clean up auth user if profile creation fails
    await supabase.auth.admin?.deleteUser(authData.user.id);
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
  const { data: profile, error } = await supabase
    .from('users')
    .select(`
      *,
      shifts:shift_id (name)
    `)
    .eq('id', authUser.id)
    .single();

  if (error || !profile) {
    return null;
  }

  return {
    id: profile.id,
    userCode: profile.user_code,
    email: profile.email,
    displayName: profile.display_name,
    role: profile.role,
    shiftId: profile.shift_id,
    shiftName: (profile.shifts as any)?.name || 'Unknown Shift',
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
export async function updatePassword(newPassword: string): Promise<void> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    throw new Error('Cannot update password in offline mode');
  }

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
}): Promise<void> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    throw new Error('Cannot update profile in offline mode');
  }

  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) {
    throw new Error('Not authenticated');
  }

  const { error } = await supabase
    .from('users')
    .update({
      display_name: updates.displayName,
      email: updates.email,
    })
    .eq('id', authUser.id);

  if (error) {
    throw new Error(error.message);
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

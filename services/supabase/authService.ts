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

// Invite token type
export interface InviteToken {
  id: string;
  token: string;
  shiftId: string;
  shiftName?: string;
  role: 'Team Leader' | 'TC';
  createdBy: string;
  createdByName?: string;
  expiresAt: string;
  usedBy: string | null;
  usedAt: string | null;
  status: 'active' | 'used' | 'expired' | 'revoked';
  metadata?: Record<string, any>;
  createdAt: string;
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

// ============================================
// USER MANAGEMENT
// ============================================

/**
 * Get all team members in the current user's shift
 * Team Leaders can see all members in their shift
 */
export async function getTeamMembers(): Promise<CloudUser[]> {
  const supabase = requireSupabaseClient();

  // Get current user to determine their shift
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    throw new Error('Not authenticated');
  }

  // Fetch all users in the same shift
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('shift_id', currentUser.shiftId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  // Transform to CloudUser format
  return (data || []).map((user) => ({
    id: user.id,
    userCode: user.user_code,
    email: user.email,
    displayName: user.display_name,
    role: user.role as 'Team Leader' | 'TC',
    shiftId: user.shift_id,
    shiftName: currentUser.shiftName, // Use current user's shift name
    preferences: user.preferences || {},
    createdAt: user.created_at,
  }));
}

/**
 * Deactivate a user account (Team Leaders only)
 * This is a soft delete - sets a flag in preferences
 */
export async function deactivateUser(userId: string): Promise<void> {
  const supabase = requireSupabaseClient();

  // Get current user to verify they're a Team Leader
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    throw new Error('Not authenticated');
  }

  if (currentUser.role !== 'Team Leader') {
    throw new Error('Only Team Leaders can deactivate users');
  }

  // Get target user to verify same shift
  const { data: targetUser, error: fetchError } = await supabase
    .from('users')
    .select('shift_id, role')
    .eq('id', userId)
    .single();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (!targetUser) {
    throw new Error('User not found');
  }

  // Can't deactivate users from different shifts
  if ((targetUser as any).shift_id !== currentUser.shiftId) {
    throw new Error('Cannot deactivate users from other shifts');
  }

  // Can't deactivate other Team Leaders
  if ((targetUser as any).role === 'Team Leader') {
    throw new Error('Cannot deactivate Team Leaders');
  }

  // Update user preferences to mark as deactivated
  const { error } = await (supabase.from('users').update as any)({
    preferences: { deactivated: true, deactivatedAt: new Date().toISOString(), deactivatedBy: currentUser.id },
  }).eq('id', userId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Reactivate a deactivated user account (Team Leaders only)
 */
export async function reactivateUser(userId: string): Promise<void> {
  const supabase = requireSupabaseClient();

  // Get current user to verify they're a Team Leader
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    throw new Error('Not authenticated');
  }

  if (currentUser.role !== 'Team Leader') {
    throw new Error('Only Team Leaders can reactivate users');
  }

  // Update user preferences to remove deactivation flag
  const { error } = await (supabase.from('users').update as any)({
    preferences: { deactivated: false },
  }).eq('id', userId);

  if (error) {
    throw new Error(error.message);
  }
}

// ============================================
// INVITE TOKEN MANAGEMENT
// ============================================

/**
 * Generate a secure random token for invites
 */
function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate an invite token (Team Leaders only)
 * @param role - Role for the invited user ('TC' or 'Team Leader')
 * @param expiresInHours - Hours until the invite expires (default: 168 = 7 days)
 * @returns The generated invite token
 */
export async function generateInviteToken(
  role: 'Team Leader' | 'TC' = 'TC',
  expiresInHours: number = 168
): Promise<InviteToken> {
  const supabase = requireSupabaseClient();

  // Get current user to verify they're a Team Leader
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    throw new Error('Not authenticated');
  }

  if (currentUser.role !== 'Team Leader') {
    throw new Error('Only Team Leaders can generate invite tokens');
  }

  // Generate secure token
  const token = generateSecureToken();

  // Calculate expiration date
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expiresInHours);

  // Insert invite token
  const { data, error } = await (supabase
    .from('invite_tokens')
    .insert as any)({
      token,
      shift_id: currentUser.shiftId,
      role,
      created_by: currentUser.id,
      expires_at: expiresAt.toISOString(),
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('Failed to create invite token');
  }

  return {
    id: data.id,
    token: data.token,
    shiftId: data.shift_id,
    shiftName: currentUser.shiftName,
    role: data.role,
    createdBy: data.created_by,
    createdByName: currentUser.displayName,
    expiresAt: data.expires_at,
    usedBy: data.used_by,
    usedAt: data.used_at,
    status: data.status,
    metadata: data.metadata || {},
    createdAt: data.created_at,
  };
}

/**
 * Get all invite tokens for the current user's shift (Team Leaders only)
 */
export async function getInviteTokens(): Promise<InviteToken[]> {
  const supabase = requireSupabaseClient();

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    throw new Error('Not authenticated');
  }

  if (currentUser.role !== 'Team Leader') {
    throw new Error('Only Team Leaders can view invite tokens');
  }

  // Fetch invite tokens with creator information
  const { data, error } = await (supabase
    .from('invite_tokens') as any)
    .select(`
      *,
      creator:created_by (display_name)
    `)
    .eq('shift_id', currentUser.shiftId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((token: any) => ({
    id: token.id,
    token: token.token,
    shiftId: token.shift_id,
    shiftName: currentUser.shiftName,
    role: token.role,
    createdBy: token.created_by,
    createdByName: token.creator?.display_name || 'Unknown',
    expiresAt: token.expires_at,
    usedBy: token.used_by,
    usedAt: token.used_at,
    status: token.status,
    metadata: token.metadata || {},
    createdAt: token.created_at,
  }));
}

/**
 * Revoke an active invite token (Team Leaders only)
 */
export async function revokeInviteToken(tokenId: string): Promise<void> {
  const supabase = requireSupabaseClient();

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    throw new Error('Not authenticated');
  }

  if (currentUser.role !== 'Team Leader') {
    throw new Error('Only Team Leaders can revoke invite tokens');
  }

  const { error } = await (supabase.from('invite_tokens').update as any)({
    status: 'revoked',
  })
    .eq('id', tokenId)
    .eq('shift_id', currentUser.shiftId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Validate an invite token (returns token details if valid)
 */
export async function validateInviteToken(token: string): Promise<InviteToken> {
  const supabase = requireSupabaseClient();

  const { data, error } = await (supabase
    .from('invite_tokens') as any)
    .select(`
      *,
      shift:shift_id (name),
      creator:created_by (display_name)
    `)
    .eq('token', token)
    .single();

  if (error || !data) {
    throw new Error('Invalid invite token');
  }

  // Check if token is active
  if (data.status !== 'active') {
    throw new Error(`This invite token has been ${data.status}`);
  }

  // Check if token is expired
  if (new Date(data.expires_at) < new Date()) {
    // Mark as expired
    await (supabase.from('invite_tokens').update as any)({ status: 'expired' })
      .eq('id', data.id);
    throw new Error('This invite token has expired');
  }

  return {
    id: data.id,
    token: data.token,
    shiftId: data.shift_id,
    shiftName: data.shift?.name || 'Unknown',
    role: data.role,
    createdBy: data.created_by,
    createdByName: data.creator?.display_name || 'Unknown',
    expiresAt: data.expires_at,
    usedBy: data.used_by,
    usedAt: data.used_at,
    status: data.status,
    metadata: data.metadata || {},
    createdAt: data.created_at,
  };
}

/**
 * Accept an invite and create a new user account
 */
export async function acceptInvite(
  token: string,
  userCode: string,
  displayName: string,
  password: string
): Promise<CloudUser> {
  const supabase = requireSupabaseClient();

  // Validate the invite token
  const inviteToken = await validateInviteToken(token);

  // Generate internal email for user code
  const email = userCodeToEmail(userCode);

  // Check if user code is already taken
  const { data: existingUser } = await supabase
    .from('users')
    .select('user_code')
    .eq('user_code', userCode)
    .single();

  if (existingUser) {
    throw new Error('User code is already taken');
  }

  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) {
    throw new Error(authError.message);
  }

  if (!authData.user) {
    throw new Error('Failed to create user account');
  }

  // Create user profile
  const { error: profileError } = await (supabase.from('users').insert as any)({
    id: authData.user.id,
    user_code: userCode,
    email: null, // User codes don't have real emails
    display_name: displayName,
    role: inviteToken.role,
    shift_id: inviteToken.shiftId,
    preferences: {},
  });

  if (profileError) {
    // Note: Cannot use admin.deleteUser in client-side code (requires service role key)
    // Sign out the orphaned auth user - admin can clean up orphaned accounts later
    console.error('[Auth] Profile creation failed, signing out orphaned auth user:', authData.user.id);
    await supabase.auth.signOut();
    throw new Error(`Failed to create user profile: ${profileError.message}`);
  }

  // Mark invite token as used
  await (supabase.from('invite_tokens').update as any)({
    status: 'used',
    used_by: authData.user.id,
    used_at: new Date().toISOString(),
  }).eq('id', inviteToken.id);

  // Return the newly created user (automatically signed in)
  const newUser = await getCurrentUser();
  if (!newUser) {
    throw new Error('Failed to retrieve user after creation');
  }

  return newUser;
}

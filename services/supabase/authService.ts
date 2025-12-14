/**
 * Supabase Authentication Service
 *
 * Handles user authentication with User Code pattern:
 * - User Code + Password (primary): EMP001 → emp001@lotb.local
 * - Email + Password (secondary): user@example.com
 * - Session management and persistence
 */

import { supabase } from './client';
import type { Database } from './types';
import type { User, Session } from '@supabase/supabase-js';

// Extend the Supabase User type with our custom user profile
export interface AppUser extends User {
  profile?: Database['public']['Tables']['users']['Row'];
}

/**
 * Sign in with User Code (e.g., "EMP001") and password
 * Converts user code to fake email pattern: emp001@lotb.local
 */
export async function signInWithUserCode(userCode: string, password: string): Promise<{
  user: AppUser | null;
  error: Error | null;
}> {
  try {
    // Convert user code to email format
    const email = `${userCode.toLowerCase()}@lotb.local`;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { user: null, error };
    }

    if (!data.user) {
      return { user: null, error: new Error('No user returned from sign in') };
    }

    // Fetch user profile from users table
    const profile = await getUserProfile(data.user.id);

    return {
      user: { ...data.user, profile } as AppUser,
      error: null,
    };
  } catch (err) {
    return {
      user: null,
      error: err instanceof Error ? err : new Error('Sign in failed'),
    };
  }
}

/**
 * Sign in with email and password (alternative method)
 */
export async function signInWithEmail(email: string, password: string): Promise<{
  user: AppUser | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { user: null, error };
    }

    if (!data.user) {
      return { user: null, error: new Error('No user returned from sign in') };
    }

    // Fetch user profile
    const profile = await getUserProfile(data.user.id);

    return {
      user: { ...data.user, profile } as AppUser,
      error: null,
    };
  } catch (err) {
    return {
      user: null,
      error: err instanceof Error ? err : new Error('Sign in failed'),
    };
  }
}

/**
 * Sign up a new user with User Code
 * This is typically called after an invite from a Team Leader
 */
export async function signUpWithUserCode(params: {
  userCode: string;
  password: string;
  displayName: string;
  role: 'Team Leader' | 'TC';
  shiftId: string;
  email?: string; // Optional real email for password reset
}): Promise<{
  user: AppUser | null;
  error: Error | null;
}> {
  try {
    // Convert user code to email format
    const fakeEmail = `${params.userCode.toLowerCase()}@lotb.local`;

    // Create auth user
    const { data, error } = await supabase.auth.signUp({
      email: fakeEmail,
      password: params.password,
    });

    if (error) {
      return { user: null, error };
    }

    if (!data.user) {
      return { user: null, error: new Error('No user returned from sign up') };
    }

    // Create user profile in users table
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: data.user.id,
        user_code: params.userCode,
        email: params.email || null,
        display_name: params.displayName,
        role: params.role,
        shift_id: params.shiftId,
      });

    if (profileError) {
      // Rollback auth user creation if profile creation fails
      await supabase.auth.admin.deleteUser(data.user.id);
      return { user: null, error: profileError };
    }

    // Fetch the created profile
    const profile = await getUserProfile(data.user.id);

    return {
      user: { ...data.user, profile } as AppUser,
      error: null,
    };
  } catch (err) {
    return {
      user: null,
      error: err instanceof Error ? err : new Error('Sign up failed'),
    };
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.auth.signOut();
    return { error };
  } catch (err) {
    return {
      error: err instanceof Error ? err : new Error('Sign out failed'),
    };
  }
}

/**
 * Get the current authenticated user with profile
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    // Fetch user profile
    const profile = await getUserProfile(user.id);

    return { ...user, profile } as AppUser;
  } catch {
    return null;
  }
}

/**
 * Get current session
 */
export async function getSession(): Promise<Session | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  } catch {
    return null;
  }
}

/**
 * Subscribe to authentication state changes
 */
export function onAuthStateChange(callback: (user: AppUser | null) => void): () => void {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      const profile = await getUserProfile(session.user.id);
      callback({ ...session.user, profile } as AppUser);
    } else {
      callback(null);
    }
  });

  return () => {
    subscription.unsubscribe();
  };
}

/**
 * Update user password
 */
export async function updatePassword(newPassword: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { error };
  } catch (err) {
    return {
      error: err instanceof Error ? err : new Error('Password update failed'),
    };
  }
}

/**
 * Update user profile (display name, email, etc.)
 */
export async function updateUserProfile(updates: {
  displayName?: string;
  email?: string;
}): Promise<{ error: Error | null }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: new Error('No authenticated user') };
    }

    const updateData: Database['public']['Tables']['users']['Update'] = {};
    if (updates.displayName) updateData.display_name = updates.displayName;
    if (updates.email !== undefined) updateData.email = updates.email;

    const { error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', user.id);

    return { error };
  } catch (err) {
    return {
      error: err instanceof Error ? err : new Error('Profile update failed'),
    };
  }
}

/**
 * Send password reset email
 * Note: Requires a real email address in the user profile
 */
export async function resetPassword(email: string): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error };
  } catch (err) {
    return {
      error: err instanceof Error ? err : new Error('Password reset failed'),
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Fetch user profile from the users table
 */
async function getUserProfile(userId: string): Promise<Database['public']['Tables']['users']['Row'] | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

/**
 * Check if a user code is already taken
 */
export async function isUserCodeAvailable(userCode: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('user_code')
      .eq('user_code', userCode)
      .maybeSingle();

    if (error) {
      console.error('Error checking user code availability:', error);
      return false;
    }

    return !data; // Available if no user found
  } catch {
    return false;
  }
}

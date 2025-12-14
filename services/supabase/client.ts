/**
 * Supabase Client
 *
 * Creates and exports a configured Supabase client instance.
 * This client is used throughout the app for database operations and authentication.
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types'; // Will be auto-generated later

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables!');
  console.error('Please create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  console.error('See .env.example for the template');

  // For development, we'll still create a dummy client to prevent crashes
  // In production, you might want to throw an error instead
}

// Create Supabase client with type safety
export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: window.localStorage, // Use localStorage for session persistence
    },
    global: {
      headers: {
        'X-Client-Info': 'lord-of-the-bins',
      },
    },
  }
);

// Export a helper to check if Supabase is properly configured
export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== 'https://placeholder.supabase.co');
};

// Helper to get current authenticated user
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Error getting current user:', error);
    return null;
  }
  return user;
};

// Helper to sign out
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

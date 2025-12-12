import { createClient } from '@supabase/supabase-js';

// Supabase configuration
// Replace these with your actual Supabase project credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Check if Supabase is configured
export const isSupabaseConfigured = () => {
  return supabaseUrl.length > 0 && supabaseAnonKey.length > 0;
};

// Create Supabase client (only if configured)
export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Database types for feedback table
export interface FeedbackRow {
  id: string;
  category: 'bug' | 'feature' | 'ui-ux' | 'question';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'submitted' | 'in-review' | 'planned' | 'in-progress' | 'completed' | 'declined';
  contact_email: string | null;
  screenshot: string | null;
  screenshot_name: string | null;
  votes: number;
  user_agent: string | null;
  app_version: string | null;
  current_page: string | null;
  created_at: string;
  updated_at: string;
}

export type FeedbackInsert = Omit<FeedbackRow, 'id' | 'created_at' | 'updated_at' | 'votes'>;
export type FeedbackUpdate = Partial<Pick<FeedbackRow, 'status' | 'priority' | 'votes'>>;

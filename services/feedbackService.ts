import { supabase, isSupabaseConfigured, FeedbackRow, FeedbackInsert, FeedbackUpdate } from '../lib/supabase';
import { FeedbackItem, FeedbackCategory, FeedbackPriority, FeedbackStatus } from '../types';

// Local storage key for fallback
const LOCAL_STORAGE_KEY = 'lotb-feedback';

// Convert database row to FeedbackItem
function rowToFeedbackItem(row: FeedbackRow): FeedbackItem {
  return {
    id: row.id,
    category: row.category as FeedbackCategory,
    title: row.title,
    description: row.description,
    priority: row.priority as FeedbackPriority,
    status: row.status as FeedbackStatus,
    contactEmail: row.contact_email || undefined,
    screenshot: row.screenshot || undefined,
    screenshotName: row.screenshot_name || undefined,
    votes: row.votes,
    userAgent: row.user_agent || undefined,
    appVersion: row.app_version || undefined,
    currentPage: row.current_page || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// Convert FeedbackItem to database insert format
function feedbackItemToInsert(item: FeedbackItem): FeedbackInsert {
  return {
    category: item.category,
    title: item.title,
    description: item.description,
    priority: item.priority,
    status: item.status,
    contact_email: item.contactEmail || null,
    screenshot: item.screenshot || null,
    screenshot_name: item.screenshotName || null,
    user_agent: item.userAgent || null,
    app_version: item.appVersion || null,
    current_page: item.currentPage || null
  };
}

// Local storage helpers
function getLocalFeedback(): FeedbackItem[] {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveLocalFeedback(items: FeedbackItem[]): void {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
}

// Feedback Service
export const feedbackService = {
  // Check if Supabase is available
  isOnline: () => isSupabaseConfigured() && supabase !== null,

  // Fetch all feedback items
  async getAll(): Promise<FeedbackItem[]> {
    // If Supabase is not configured, use local storage
    if (!isSupabaseConfigured() || !supabase) {
      return getLocalFeedback();
    }

    try {
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase fetch error:', error);
        // Fallback to local storage
        return getLocalFeedback();
      }

      const items = (data as FeedbackRow[]).map(rowToFeedbackItem);

      // Also update local storage as backup
      saveLocalFeedback(items);

      return items;
    } catch (err) {
      console.error('Feedback fetch error:', err);
      return getLocalFeedback();
    }
  },

  // Submit new feedback
  async submit(item: FeedbackItem): Promise<{ success: boolean; error?: string }> {
    // Always save to local storage first as backup
    const localItems = getLocalFeedback();
    saveLocalFeedback([item, ...localItems]);

    // If Supabase is not configured, just use local storage
    if (!isSupabaseConfigured() || !supabase) {
      return { success: true };
    }

    try {
      const insertData = feedbackItemToInsert(item);

      const { error } = await supabase
        .from('feedback')
        .insert([insertData]);

      if (error) {
        console.error('Supabase insert error:', error);
        return { success: true }; // Still successful locally
      }

      return { success: true };
    } catch (err) {
      console.error('Feedback submit error:', err);
      return { success: true }; // Still successful locally
    }
  },

  // Update feedback status
  async updateStatus(id: string, status: FeedbackStatus): Promise<{ success: boolean; error?: string }> {
    // Update local storage
    const localItems = getLocalFeedback();
    const updatedItems = localItems.map(item =>
      item.id === id ? { ...item, status, updatedAt: new Date().toISOString() } : item
    );
    saveLocalFeedback(updatedItems);

    // If Supabase is not configured, just use local storage
    if (!isSupabaseConfigured() || !supabase) {
      return { success: true };
    }

    try {
      const { error } = await supabase
        .from('feedback')
        .update({ status } as FeedbackUpdate)
        .eq('id', id);

      if (error) {
        console.error('Supabase update error:', error);
        return { success: true }; // Still successful locally
      }

      return { success: true };
    } catch (err) {
      console.error('Feedback update error:', err);
      return { success: true }; // Still successful locally
    }
  },

  // Delete feedback item
  async delete(id: string): Promise<{ success: boolean; error?: string }> {
    // Remove from local storage
    const localItems = getLocalFeedback();
    saveLocalFeedback(localItems.filter(item => item.id !== id));

    // If Supabase is not configured, just use local storage
    if (!isSupabaseConfigured() || !supabase) {
      return { success: true };
    }

    try {
      const { error } = await supabase
        .from('feedback')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Supabase delete error:', error);
        return { success: true }; // Still successful locally
      }

      return { success: true };
    } catch (err) {
      console.error('Feedback delete error:', err);
      return { success: true }; // Still successful locally
    }
  },

  // Clear all feedback (admin action)
  async clearAll(): Promise<{ success: boolean; error?: string }> {
    // Clear local storage
    saveLocalFeedback([]);

    // If Supabase is not configured, just use local storage
    if (!isSupabaseConfigured() || !supabase) {
      return { success: true };
    }

    try {
      // Note: This deletes ALL feedback - use with caution
      const { error } = await supabase
        .from('feedback')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Match all

      if (error) {
        console.error('Supabase clear error:', error);
        return { success: true }; // Still successful locally
      }

      return { success: true };
    } catch (err) {
      console.error('Feedback clear error:', err);
      return { success: true }; // Still successful locally
    }
  },

  // Vote on feedback (upvote)
  async upvote(id: string): Promise<{ success: boolean; error?: string }> {
    // Update local storage
    const localItems = getLocalFeedback();
    const updatedItems = localItems.map(item =>
      item.id === id ? { ...item, votes: item.votes + 1, updatedAt: new Date().toISOString() } : item
    );
    saveLocalFeedback(updatedItems);

    // If Supabase is not configured, just use local storage
    if (!isSupabaseConfigured() || !supabase) {
      return { success: true };
    }

    try {
      // Get current votes first
      const { data: currentData, error: fetchError } = await supabase
        .from('feedback')
        .select('votes')
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error('Supabase fetch for upvote error:', fetchError);
        return { success: true };
      }

      const currentVotes = (currentData as { votes: number })?.votes || 0;

      const { error } = await supabase
        .from('feedback')
        .update({ votes: currentVotes + 1 } as FeedbackUpdate)
        .eq('id', id);

      if (error) {
        console.error('Supabase upvote error:', error);
        return { success: true };
      }

      return { success: true };
    } catch (err) {
      console.error('Feedback upvote error:', err);
      return { success: true };
    }
  },

  // Sync local feedback to Supabase (for items submitted while offline)
  async syncToSupabase(): Promise<{ synced: number; errors: number }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { synced: 0, errors: 0 };
    }

    const localItems = getLocalFeedback();
    let synced = 0;
    let errors = 0;

    // Get all IDs from Supabase
    const { data: remoteData, error: fetchError } = await supabase
      .from('feedback')
      .select('id');

    if (fetchError) {
      console.error('Sync fetch error:', fetchError);
      return { synced: 0, errors: localItems.length };
    }

    const remoteIds = new Set((remoteData as { id: string }[]).map(r => r.id));

    // Upload items that don't exist remotely
    for (const item of localItems) {
      if (!remoteIds.has(item.id)) {
        try {
          const insertData = feedbackItemToInsert(item);
          const { error } = await supabase
            .from('feedback')
            .insert([{ ...insertData, id: item.id }]);

          if (error) {
            errors++;
          } else {
            synced++;
          }
        } catch {
          errors++;
        }
      }
    }

    return { synced, errors };
  }
};

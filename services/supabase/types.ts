/**
 * Supabase Database Types - Lord of the Bins
 *
 * These types match the database schema defined in supabase/migrations/
 * In production, these would be auto-generated using:
 * npx supabase gen types typescript --project-id <project-id>
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      shifts: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          user_code: string;
          email: string | null;
          display_name: string;
          role: 'Team Leader' | 'TC';
          shift_id: string;
          preferences: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_code: string;
          email?: string | null;
          display_name: string;
          role: 'Team Leader' | 'TC';
          shift_id: string;
          preferences?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_code?: string;
          email?: string | null;
          display_name?: string;
          role?: 'Team Leader' | 'TC';
          shift_id?: string;
          preferences?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      operators: {
        Row: {
          id: string;
          local_id: string | null;
          shift_id: string;
          name: string;
          employee_id: string | null;
          type: 'Regular' | 'Flex' | 'Coordinator';
          status: 'Active' | 'Leave' | 'Sick' | 'Training' | 'Holiday';
          skills: string[];
          availability: Json;
          preferred_tasks: string[];
          archived: boolean;
          sync_status: 'synced' | 'pending' | 'conflict';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          local_id?: string | null;
          shift_id: string;
          name: string;
          employee_id?: string | null;
          type: 'Regular' | 'Flex' | 'Coordinator';
          status?: 'Active' | 'Leave' | 'Sick' | 'Training' | 'Holiday';
          skills?: string[];
          availability?: Json;
          preferred_tasks?: string[];
          archived?: boolean;
          sync_status?: 'synced' | 'pending' | 'conflict';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          local_id?: string | null;
          shift_id?: string;
          name?: string;
          employee_id?: string | null;
          type?: 'Regular' | 'Flex' | 'Coordinator';
          status?: 'Active' | 'Leave' | 'Sick' | 'Training' | 'Holiday';
          skills?: string[];
          availability?: Json;
          preferred_tasks?: string[];
          archived?: boolean;
          sync_status?: 'synced' | 'pending' | 'conflict';
          created_at?: string;
          updated_at?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          local_id: string | null;
          shift_id: string;
          name: string;
          required_skill: string;
          color: string;
          text_color: string;
          is_heavy: boolean;
          is_coordinator_only: boolean;
          archived: boolean;
          sync_status: 'synced' | 'pending' | 'conflict';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          local_id?: string | null;
          shift_id: string;
          name: string;
          required_skill: string;
          color: string;
          text_color?: string;
          is_heavy?: boolean;
          is_coordinator_only?: boolean;
          archived?: boolean;
          sync_status?: 'synced' | 'pending' | 'conflict';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          local_id?: string | null;
          shift_id?: string;
          name?: string;
          required_skill?: string;
          color?: string;
          text_color?: string;
          is_heavy?: boolean;
          is_coordinator_only?: boolean;
          archived?: boolean;
          sync_status?: 'synced' | 'pending' | 'conflict';
          created_at?: string;
          updated_at?: string;
        };
      };
      task_requirements: {
        Row: {
          id: string;
          local_id: string | null;
          shift_id: string;
          task_id: string;
          enabled: boolean;
          default_requirements: Json;
          daily_overrides: Json;
          sync_status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          local_id?: string | null;
          shift_id: string;
          task_id: string;
          enabled?: boolean;
          default_requirements?: Json;
          daily_overrides?: Json;
          sync_status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          local_id?: string | null;
          shift_id?: string;
          task_id?: string;
          enabled?: boolean;
          default_requirements?: Json;
          daily_overrides?: Json;
          sync_status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      schedules: {
        Row: {
          id: string;
          local_id: string | null;
          shift_id: string;
          week_start_date: string;
          week_label: string | null;
          status: 'Draft' | 'Published';
          locked: boolean;
          assignments: Json;
          created_by: string | null;
          published_by: string | null;
          published_at: string | null;
          sync_status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          local_id?: string | null;
          shift_id: string;
          week_start_date: string;
          week_label?: string | null;
          status?: 'Draft' | 'Published';
          locked?: boolean;
          assignments?: Json;
          created_by?: string | null;
          published_by?: string | null;
          published_at?: string | null;
          sync_status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          local_id?: string | null;
          shift_id?: string;
          week_start_date?: string;
          week_label?: string | null;
          status?: 'Draft' | 'Published';
          locked?: boolean;
          assignments?: Json;
          created_by?: string | null;
          published_by?: string | null;
          published_at?: string | null;
          sync_status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      scheduling_rules: {
        Row: {
          id: string;
          local_id: string | null;
          shift_id: string;
          algorithm: 'greedy' | 'greedy-tabu' | 'multi-objective' | 'max-matching';
          strict_skill_matching: boolean;
          allow_consecutive_heavy_shifts: boolean;
          prioritize_flex_for_exceptions: boolean;
          respect_preferred_stations: boolean;
          max_consecutive_days_on_same_task: number;
          fair_distribution: boolean;
          balance_workload: boolean;
          auto_assign_coordinators: boolean;
          randomization_factor: number;
          prioritize_skill_variety: boolean;
          heavy_tasks: string[];
          soft_tasks: string[];
          sync_status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          local_id?: string | null;
          shift_id: string;
          algorithm?: 'greedy' | 'greedy-tabu' | 'multi-objective' | 'max-matching';
          strict_skill_matching?: boolean;
          allow_consecutive_heavy_shifts?: boolean;
          prioritize_flex_for_exceptions?: boolean;
          respect_preferred_stations?: boolean;
          max_consecutive_days_on_same_task?: number;
          fair_distribution?: boolean;
          balance_workload?: boolean;
          auto_assign_coordinators?: boolean;
          randomization_factor?: number;
          prioritize_skill_variety?: boolean;
          heavy_tasks?: string[];
          soft_tasks?: string[];
          sync_status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          local_id?: string | null;
          shift_id?: string;
          algorithm?: 'greedy' | 'greedy-tabu' | 'multi-objective' | 'max-matching';
          strict_skill_matching?: boolean;
          allow_consecutive_heavy_shifts?: boolean;
          prioritize_flex_for_exceptions?: boolean;
          respect_preferred_stations?: boolean;
          max_consecutive_days_on_same_task?: number;
          fair_distribution?: boolean;
          balance_workload?: boolean;
          auto_assign_coordinators?: boolean;
          randomization_factor?: number;
          prioritize_skill_variety?: boolean;
          heavy_tasks?: string[];
          soft_tasks?: string[];
          sync_status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      activity_log: {
        Row: {
          id: string;
          shift_id: string;
          user_id: string | null;
          action_type: string;
          entity_type: string;
          entity_id: string | null;
          entity_name: string | null;
          details: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          shift_id: string;
          user_id?: string | null;
          action_type: string;
          entity_type: string;
          entity_id?: string | null;
          entity_name?: string | null;
          details?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          shift_id?: string;
          user_id?: string | null;
          action_type?: string;
          entity_type?: string;
          entity_id?: string | null;
          entity_name?: string | null;
          details?: Json;
          created_at?: string;
        };
      };
      app_settings: {
        Row: {
          id: string;
          shift_id: string;
          theme: 'Modern' | 'Midnight';
          color_palette: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shift_id: string;
          theme?: 'Modern' | 'Midnight';
          color_palette?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shift_id?: string;
          theme?: 'Modern' | 'Midnight';
          color_palette?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      planning_templates: {
        Row: {
          id: string;
          local_id: string | null;
          shift_id: string;
          name: string;
          description: string | null;
          exclusions: Json;
          rules: Json;
          created_by: string | null;
          sync_status: 'synced' | 'pending' | 'conflict';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          local_id?: string | null;
          shift_id: string;
          name: string;
          description?: string | null;
          exclusions?: Json;
          rules?: Json;
          created_by?: string | null;
          sync_status?: 'synced' | 'pending' | 'conflict';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          local_id?: string | null;
          shift_id?: string;
          name?: string;
          description?: string | null;
          exclusions?: Json;
          rules?: Json;
          created_by?: string | null;
          sync_status?: 'synced' | 'pending' | 'conflict';
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_user_shift_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      get_user_role: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// Convenience type aliases
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];

// Specific table types
export type DbShift = Tables<'shifts'>;
export type DbUser = Tables<'users'>;
export type DbOperator = Tables<'operators'>;
export type DbTask = Tables<'tasks'>;
export type DbTaskRequirement = Tables<'task_requirements'>;
export type DbSchedule = Tables<'schedules'>;
export type DbSchedulingRules = Tables<'scheduling_rules'>;
export type DbActivityLog = Tables<'activity_log'>;
export type DbAppSettings = Tables<'app_settings'>;
export type DbPlanningTemplate = Tables<'planning_templates'>;

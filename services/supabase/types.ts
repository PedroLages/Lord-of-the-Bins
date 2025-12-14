/**
 * Supabase Database Types
 *
 * Hand-crafted types based on our schema.
 * These match the tables created in migrations.
 *
 * To auto-generate these types in the future, run:
 * npx supabase gen types typescript --project-id <your-project-ref> > services/supabase/types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

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
          created_at?: string;
          updated_at?: string;
        };
      };
      operators: {
        Row: {
          id: string;
          shift_id: string;
          name: string;
          employee_id: string | null;
          type: 'Regular' | 'Flex' | 'Coordinator';
          status: 'Active' | 'Leave' | 'Sick';
          skills: string[];
          availability: Json;
          preferred_tasks: string[];
          archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shift_id: string;
          name: string;
          employee_id?: string | null;
          type: 'Regular' | 'Flex' | 'Coordinator';
          status: 'Active' | 'Leave' | 'Sick';
          skills?: string[];
          availability?: Json;
          preferred_tasks?: string[];
          archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shift_id?: string;
          name?: string;
          employee_id?: string | null;
          type?: 'Regular' | 'Flex' | 'Coordinator';
          status?: 'Active' | 'Leave' | 'Sick';
          skills?: string[];
          availability?: Json;
          preferred_tasks?: string[];
          archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      tasks: {
        Row: {
          id: string;
          shift_id: string;
          name: string;
          required_skill: string;
          color: string;
          is_heavy: boolean;
          archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shift_id: string;
          name: string;
          required_skill: string;
          color: string;
          is_heavy?: boolean;
          archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shift_id?: string;
          name?: string;
          required_skill?: string;
          color?: string;
          is_heavy?: boolean;
          archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      task_requirements: {
        Row: {
          id: string;
          shift_id: string;
          task_id: string;
          enabled: boolean;
          default_requirements: Json;
          day_overrides: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shift_id: string;
          task_id: string;
          enabled?: boolean;
          default_requirements: Json;
          day_overrides?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shift_id?: string;
          task_id?: string;
          enabled?: boolean;
          default_requirements?: Json;
          day_overrides?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      schedules: {
        Row: {
          id: string;
          shift_id: string;
          week_start_date: string;
          status: 'Draft' | 'Published';
          locked: boolean;
          assignments: Json;
          created_by: string | null;
          published_by: string | null;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shift_id: string;
          week_start_date: string;
          status?: 'Draft' | 'Published';
          locked?: boolean;
          assignments: Json;
          created_by?: string | null;
          published_by?: string | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shift_id?: string;
          week_start_date?: string;
          status?: 'Draft' | 'Published';
          locked?: boolean;
          assignments?: Json;
          created_by?: string | null;
          published_by?: string | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      scheduling_rules: {
        Row: {
          id: string;
          shift_id: string;
          strict_skill_matching: boolean;
          allow_consecutive_heavy_shifts: boolean;
          prioritize_flex_for_exceptions: boolean;
          respect_preferred_stations: boolean;
          max_consecutive_days_on_same_task: number;
          fair_distribution: boolean;
          balance_workload: boolean;
          auto_assign_coordinators: boolean;
          randomization_factor: number;
          use_v2_algorithm: boolean;
          prioritize_skill_variety: boolean;
          algorithm: 'greedy' | 'greedy-tabu' | 'multi-objective' | 'max-matching';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shift_id: string;
          strict_skill_matching?: boolean;
          allow_consecutive_heavy_shifts?: boolean;
          prioritize_flex_for_exceptions?: boolean;
          respect_preferred_stations?: boolean;
          max_consecutive_days_on_same_task?: number;
          fair_distribution?: boolean;
          balance_workload?: boolean;
          auto_assign_coordinators?: boolean;
          randomization_factor?: number;
          use_v2_algorithm?: boolean;
          prioritize_skill_variety?: boolean;
          algorithm?: 'greedy' | 'greedy-tabu' | 'multi-objective' | 'max-matching';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shift_id?: string;
          strict_skill_matching?: boolean;
          allow_consecutive_heavy_shifts?: boolean;
          prioritize_flex_for_exceptions?: boolean;
          respect_preferred_stations?: boolean;
          max_consecutive_days_on_same_task?: number;
          fair_distribution?: boolean;
          balance_workload?: boolean;
          auto_assign_coordinators?: boolean;
          randomization_factor?: number;
          use_v2_algorithm?: boolean;
          prioritize_skill_variety?: boolean;
          algorithm?: 'greedy' | 'greedy-tabu' | 'multi-objective' | 'max-matching';
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
          details?: Json;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_user_shift_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      is_team_leader: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

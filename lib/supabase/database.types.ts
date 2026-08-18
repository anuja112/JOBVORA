export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type ResumeStatus = "uploaded" | "processing" | "parsed" | "failed"
export type JobPlatform = "greenhouse" | "lever" | "workable" | "wellfound"
export type AppliedStatus =
  | "not_applied"
  | "applied"
  | "interviewing"
  | "rejected"
  | "offer"
export type ApplicationStatus = "detecting_fields" | "missing_profile_info" | "ready_to_apply" | "submitting" | "submitted" | "failed"
export type SubscriptionPlan = "free" | "pro" | "unlimited"

export interface LinkItem {
  label: string
  url: string
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          headline: string | null
          email: string | null
          phone: string | null
          location: string | null
          summary: string | null
          skills: string[]
          links: LinkItem[] | Json
          custom_fields: Json
          preferred_location: string | null
          target_role: string | null
          job_type_preference: string | null
          active_resume_id: string | null
          onboarding_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          headline?: string | null
          email?: string | null
          phone?: string | null
          location?: string | null
          summary?: string | null
          skills?: string[]
          links?: LinkItem[] | Json
          custom_fields?: Json
          preferred_location?: string | null
          target_role?: string | null
          job_type_preference?: string | null
          active_resume_id?: string | null
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          headline?: string | null
          email?: string | null
          phone?: string | null
          location?: string | null
          summary?: string | null
          skills?: string[]
          links?: LinkItem[] | Json
          custom_fields?: Json
          preferred_location?: string | null
          target_role?: string | null
          job_type_preference?: string | null
          active_resume_id?: string | null
          onboarding_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_resume_id_fkey"
            columns: ["active_resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      resumes: {
        Row: {
          id: string
          user_id: string
          file_name: string
          storage_path: string
          mime_type: string
          file_size: number
          status: ResumeStatus
          parse_error: string | null
          version: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          file_name: string
          storage_path: string
          mime_type: string
          file_size: number
          status?: ResumeStatus
          parse_error?: string | null
          version?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          file_name?: string
          storage_path?: string
          mime_type?: string
          file_size?: number
          status?: ResumeStatus
          parse_error?: string | null
          version?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      work_experiences: {
        Row: {
          id: string
          user_id: string
          resume_id: string | null
          company: string
          title: string
          location: string | null
          start_date: string | null
          end_date: string | null
          is_current: boolean
          description: string | null
          bullets: string[]
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          resume_id?: string | null
          company: string
          title: string
          location?: string | null
          start_date?: string | null
          end_date?: string | null
          is_current?: boolean
          description?: string | null
          bullets?: string[]
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          resume_id?: string | null
          company?: string
          title?: string
          location?: string | null
          start_date?: string | null
          end_date?: string | null
          is_current?: boolean
          description?: string | null
          bullets?: string[]
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_experiences_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      educations: {
        Row: {
          id: string
          user_id: string
          resume_id: string | null
          institution: string
          degree: string | null
          field_of_study: string | null
          start_date: string | null
          end_date: string | null
          description: string | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          resume_id?: string | null
          institution: string
          degree?: string | null
          field_of_study?: string | null
          start_date?: string | null
          end_date?: string | null
          description?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          resume_id?: string | null
          institution?: string
          degree?: string | null
          field_of_study?: string | null
          start_date?: string | null
          end_date?: string | null
          description?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "educations_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          id: string
          user_id: string
          resume_id: string | null
          name: string
          description: string | null
          tech_stack: string[]
          link: string | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          resume_id?: string | null
          name: string
          description?: string | null
          tech_stack?: string[]
          link?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          resume_id?: string | null
          name?: string
          description?: string | null
          tech_stack?: string[]
          link?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      certifications: {
        Row: {
          id: string
          user_id: string
          resume_id: string | null
          name: string
          issuer: string | null
          issue_date: string | null
          credential_url: string | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          resume_id?: string | null
          name: string
          issuer?: string | null
          issue_date?: string | null
          credential_url?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          resume_id?: string | null
          name?: string
          issuer?: string | null
          issue_date?: string | null
          credential_url?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certifications_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          id: string
          user_id: string
          platform: JobPlatform
          title: string
          company: string | null
          company_logo: string | null
          location: string | null
          salary: string | null
          job_type: string | null
          experience_level: string | null
          description: string | null
          tags: string[] | Json
          match_score: number
          job_url: string
          source_url: string | null
          applied_status: AppliedStatus
          saved_status: boolean
          fetched_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          platform: JobPlatform
          title: string
          company?: string | null
          company_logo?: string | null
          location?: string | null
          salary?: string | null
          job_type?: string | null
          experience_level?: string | null
          description?: string | null
          tags?: string[] | Json
          match_score?: number
          job_url: string
          source_url?: string | null
          applied_status?: AppliedStatus
          saved_status?: boolean
          fetched_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          platform?: JobPlatform
          title?: string
          company?: string | null
          company_logo?: string | null
          location?: string | null
          salary?: string | null
          job_type?: string | null
          experience_level?: string | null
          description?: string | null
          tags?: string[] | Json
          match_score?: number
          job_url?: string
          source_url?: string | null
          applied_status?: AppliedStatus
          saved_status?: boolean
          fetched_at?: string
          created_at?: string
        }
        Relationships: []
      }
      job_applications: {
        Row: { id: string; user_id: string; job_id: string; platform: string; application_url: string; status: ApplicationStatus; required_fields: Json; missing_fields: Json; field_mapping: Json; browserbase_session_id: string | null; pending_action: string | null; submitted_at: string | null; error_message: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; job_id: string; platform?: string; application_url: string; status?: ApplicationStatus; required_fields?: Json; missing_fields?: Json; field_mapping?: Json; browserbase_session_id?: string | null; pending_action?: string | null; submitted_at?: string | null; error_message?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; user_id?: string; job_id?: string; platform?: string; application_url?: string; status?: ApplicationStatus; required_fields?: Json; missing_fields?: Json; field_mapping?: Json; browserbase_session_id?: string | null; pending_action?: string | null; submitted_at?: string | null; error_message?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      user_subscriptions: {
        Row: { user_id: string; plan: SubscriptionPlan; plan_name: string; plan_limit: number | null; stripe_customer_id: string | null; stripe_subscription_id: string | null; subscription_status: string; payment_status: string; current_period_start: string | null; current_period_end: string | null; created_at: string; updated_at: string }
        Insert: { user_id: string; plan?: SubscriptionPlan; plan_name?: string; plan_limit?: number | null; stripe_customer_id?: string | null; stripe_subscription_id?: string | null; subscription_status?: string; payment_status?: string; current_period_start?: string | null; current_period_end?: string | null; created_at?: string; updated_at?: string }
        Update: { user_id?: string; plan?: SubscriptionPlan; plan_name?: string; plan_limit?: number | null; stripe_customer_id?: string | null; stripe_subscription_id?: string | null; subscription_status?: string; payment_status?: string; current_period_start?: string | null; current_period_end?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      daily_apply_usage: {
        Row: { user_id: string; usage_date: string; ai_apply_count: number; created_at: string; updated_at: string }
        Insert: { user_id: string; usage_date?: string; ai_apply_count?: number; created_at?: string; updated_at?: string }
        Update: { user_id?: string; usage_date?: string; ai_apply_count?: number; created_at?: string; updated_at?: string }
        Relationships: []
      }
      billing_history: {
        Row: { id: string; user_id: string; stripe_customer_id: string | null; stripe_subscription_id: string | null; stripe_event_id: string | null; plan_name: string | null; amount_cents: number | null; currency: string | null; payment_status: string | null; event_type: string; details: Json; created_at: string }
        Insert: { id?: string; user_id: string; stripe_customer_id?: string | null; stripe_subscription_id?: string | null; stripe_event_id?: string | null; plan_name?: string | null; amount_cents?: number | null; currency?: string | null; payment_status?: string | null; event_type: string; details?: Json; created_at?: string }
        Update: { id?: string; user_id?: string; stripe_customer_id?: string | null; stripe_subscription_id?: string | null; stripe_event_id?: string | null; plan_name?: string | null; amount_cents?: number | null; currency?: string | null; payment_status?: string | null; event_type?: string; details?: Json; created_at?: string }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      check_and_increment_ai_apply_usage: {
        Args: { p_user_id: string }
        Returns: Json
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

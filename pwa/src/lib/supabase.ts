import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database Types
export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          tier: 'free_tier' | 'weekend_warrior' | 'master_tech'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          tier?: 'free_tier' | 'weekend_warrior' | 'master_tech'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          tier?: 'free_tier' | 'weekend_warrior' | 'master_tech'
          created_at?: string
          updated_at?: string
        }
      }
      vehicles: {
        Row: {
          id: string
          user_id: string
          make: string
          model: string
          year: number
          trim: string | null
          engine: string | null
          nickname: string | null
          vin: string | null
          notes: string | null
          mileage: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          make: string
          model: string
          year: number
          trim?: string | null
          engine?: string | null
          nickname?: string | null
          vin?: string | null
          notes?: string | null
          mileage?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          make?: string
          model?: string
          year?: number
          trim?: string | null
          engine?: string | null
          nickname?: string | null
          vin?: string | null
          notes?: string | null
          mileage?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          user_id: string
          vehicle_id: string | null
          filename: string
          original_filename: string
          category: 'service_manual' | 'owner_manual' | 'maintenance_record' | 'parts_diagram' | 'photo' | 'video' | 'other'
          description: string | null
          file_size_bytes: number
          storage_path: string
          status: 'uploaded' | 'processing' | 'processed' | 'error'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          vehicle_id?: string | null
          filename: string
          original_filename: string
          category: 'service_manual' | 'owner_manual' | 'maintenance_record' | 'parts_diagram' | 'photo' | 'video' | 'other'
          description?: string | null
          file_size_bytes: number
          storage_path: string
          status?: 'uploaded' | 'processing' | 'processed' | 'error'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          vehicle_id?: string | null
          filename?: string
          original_filename?: string
          category?: 'service_manual' | 'owner_manual' | 'maintenance_record' | 'parts_diagram' | 'photo' | 'video' | 'other'
          description?: string | null
          file_size_bytes?: number
          storage_path?: string
          status?: 'uploaded' | 'processing' | 'processed' | 'error'
          created_at?: string
          updated_at?: string
        }
      }
      usage_logs: {
        Row: {
          id: string
          user_id: string
          action_type: 'question' | 'document_upload' | 'audio_request'
          cost_cents: number
          metadata: any
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          action_type: 'question' | 'document_upload' | 'audio_request'
          cost_cents?: number
          metadata?: any
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          action_type?: 'question' | 'document_upload' | 'audio_request'
          cost_cents?: number
          metadata?: any
          created_at?: string
        }
      }
      conversations: {
        Row: {
          id: string
          user_id: string
          vehicle_id: string | null
          question: string
          answer: string
          audio_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          vehicle_id?: string | null
          question: string
          answer: string
          audio_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          vehicle_id?: string | null
          question?: string
          answer?: string
          audio_url?: string | null
          created_at?: string
        }
      }
    }
    Functions: {
      check_daily_question_limit: {
        Args: { user_uuid: string }
        Returns: boolean
      }
      check_monthly_question_limit: {
        Args: { user_uuid: string }
        Returns: boolean
      }
      log_usage: {
        Args: {
          user_uuid: string
          action: string
          cost?: number
          meta?: any
        }
        Returns: void
      }
    }
  }
}

// Helper functions
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export const signIn = async (email: string, password: string) => {
  return await supabase.auth.signInWithPassword({ email, password })
}

export const signUp = async (email: string, password: string, fullName?: string) => {
  return await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      }
    }
  })
}

export const signOut = async () => {
  return await supabase.auth.signOut()
}

export const checkQuestionLimit = async (userId: string, tier: string) => {
  if (tier === 'free_tier') {
    const { data } = await supabase.rpc('check_daily_question_limit', { user_uuid: userId })
    return data
  } else if (tier === 'master_tech') {
    const { data } = await supabase.rpc('check_monthly_question_limit', { user_uuid: userId })
    return data
  }
  // weekend_warrior has no limits (pay per use)
  return true
}

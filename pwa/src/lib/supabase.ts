import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      query_logs: {
        Row: {
          id: string
          user_id: string
          question: string
          answer: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          question: string
          answer: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          question?: string
          answer?: string
          created_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          user_id: string | null
          title: string
          filename: string
          document_type: string
          car_make: string | null
          car_model: string | null
          car_year: number | null
          car_engine: string | null
          file_size: number
          page_count: number | null
          storage_path: string | null
          status: string
          upload_date: string | null
          processed_date: string | null
          error_message: string | null
          tags: string[]
          is_public: boolean
        }
        Insert: {
          id?: string
          user_id?: string | null
          title: string
          filename: string
          document_type: string
          car_make?: string | null
          car_model?: string | null
          car_year?: number | null
          car_engine?: string | null
          file_size: number
          page_count?: number | null
          storage_path?: string | null
          status?: string
          upload_date?: string | null
          processed_date?: string | null
          error_message?: string | null
          tags?: string[]
          is_public?: boolean
        }
        Update: {
          id?: string
          user_id?: string | null
          title?: string
          filename?: string
          document_type?: string
          car_make?: string | null
          car_model?: string | null
          car_year?: number | null
          car_engine?: string | null
          file_size?: number
          page_count?: number | null
          storage_path?: string | null
          status?: string
          upload_date?: string | null
          processed_date?: string | null
          error_message?: string | null
          tags?: string[]
          is_public?: boolean
        }
      }
    }
  }
}

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
      // User preferences and settings
      user_preferences: {
        Row: {
          id: string
          user_id: string
          torque_unit: 'newton_meters' | 'pound_feet'
          pressure_unit: 'psi' | 'bar' | 'kilopascals'
          length_unit: 'metric' | 'imperial'
          volume_unit: 'metric' | 'imperial'
          temperature_unit: 'celsius' | 'fahrenheit'
          weight_unit: 'metric' | 'imperial'
          socket_unit: 'metric' | 'imperial'
          auto_play?: boolean | null
          voice_enabled?: boolean | null
          playback_speed?: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          torque_unit?: 'newton_meters' | 'pound_feet'
          pressure_unit?: 'psi' | 'bar' | 'kilopascals'
          length_unit?: 'metric' | 'imperial'
          volume_unit?: 'metric' | 'imperial'
          temperature_unit?: 'celsius' | 'fahrenheit'
          weight_unit?: 'metric' | 'imperial'
          socket_unit?: 'metric' | 'imperial'
          auto_play?: boolean | null
          voice_enabled?: boolean | null
          playback_speed?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          torque_unit?: 'newton_meters' | 'pound_feet'
          pressure_unit?: 'psi' | 'bar' | 'kilopascals'
          length_unit?: 'metric' | 'imperial'
          volume_unit?: 'metric' | 'imperial'
          temperature_unit?: 'celsius' | 'fahrenheit'
          weight_unit?: 'metric' | 'imperial'
          socket_unit?: 'metric' | 'imperial'
          auto_play?: boolean | null
          voice_enabled?: boolean | null
          playback_speed?: number | null
          updated_at?: string
        }
      }

      // Vehicle garage management
      vehicles: {
        Row: {
          id: string
          user_id: string
          make: string
          model: string
          year: number
          trim?: string
          engine?: string
          vin?: string
          nickname?: string
          notes?: string
          mileage?: number
          is_active?: boolean
          deactivated_at?: string
          deactivation_reason?: string
          last_used_at?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          make: string
          model: string
          year: number
          trim?: string
          engine?: string
          vin?: string
          nickname?: string
          notes?: string
          mileage?: number
          is_active?: boolean
          deactivated_at?: string
          deactivation_reason?: string
          last_used_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          make?: string
          model?: string
          year?: number
          trim?: string
          engine?: string
          vin?: string
          nickname?: string
          notes?: string
          mileage?: number
          is_active?: boolean
          deactivated_at?: string
          deactivation_reason?: string
          last_used_at?: string
          updated_at?: string
        }
      }

      // Document uploads and management
      documents: {
        Row: {
          id: string
          user_id: string
          filename: string
          original_filename: string
          file_size: number
          file_type: string
          document_type: 'service_manual' | 'repair_manual' | 'owners_manual' | 'parts_catalog' | 'wiring_diagram' | 'other'
          car_make?: string
          car_model?: string
          car_year?: number
          status: 'uploaded' | 'processing' | 'processed' | 'failed' | 'inactive'
          storage_path: string
          metadata: Json
          deactivated_at?: string
          deactivation_reason?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          filename: string
          original_filename: string
          file_size: number
          file_type: string
          document_type: 'service_manual' | 'repair_manual' | 'owners_manual' | 'parts_catalog' | 'wiring_diagram' | 'other'
          car_make?: string
          car_model?: string
          car_year?: number
          status?: 'uploaded' | 'processing' | 'processed' | 'failed' | 'inactive'
          storage_path: string
          metadata?: Json
          deactivated_at?: string
          deactivation_reason?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          filename?: string
          status?: 'uploaded' | 'processing' | 'processed' | 'failed' | 'inactive'
          metadata?: Json
          deactivated_at?: string
          deactivation_reason?: string
          updated_at?: string
        }
      }

      // User tiers and subscription management
      user_tiers: {
        Row: {
          id: string
          user_id: string
          tier: 'free_tier' | 'weekend_warrior' | 'master_tech'
          tier_override?: 'free_tier' | 'weekend_warrior' | 'master_tech'
          tier_override_expires_at?: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tier?: 'free_tier' | 'weekend_warrior' | 'master_tech'
          tier_override?: 'free_tier' | 'weekend_warrior' | 'master_tech'
          tier_override_expires_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          tier?: 'free_tier' | 'weekend_warrior' | 'master_tech'
          tier_override?: 'free_tier' | 'weekend_warrior' | 'master_tech'
          tier_override_expires_at?: string
          updated_at?: string
        }
      }

      // Usage tracking for rate limiting
      usage_records: {
        Row: {
          id: string
          user_id: string
          usage_type: 'ask_query' | 'document_upload' | 'tts_request'
          action_type: 'ask_query' | 'document_upload' | 'tts_request'
          timestamp: string
          cost_cents?: number
          details?: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          usage_type: 'ask_query' | 'document_upload' | 'tts_request'
          action_type: 'ask_query' | 'document_upload' | 'tts_request'
          timestamp?: string
          cost_cents?: number
          details?: Json
          created_at?: string
        }
        Update: {
          cost_cents?: number
          details?: Json
        }
      }

      // Daily usage statistics
      daily_usage_stats: {
        Row: {
          id: string
          user_id: string
          date: string
          ask_count: number
          document_upload_count: number
          tts_count: number
          stt_count: number
          total_cost_cents: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          ask_count?: number
          document_upload_count?: number
          tts_count?: number
          stt_count?: number
          total_cost_cents?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          ask_count?: number
          document_upload_count?: number
          tts_count?: number
          stt_count?: number
          total_cost_cents?: number
          updated_at?: string
        }
      }

      // Subscription management
      subscriptions: {
        Row: {
          id: string
          user_id: string
          platform: 'ios' | 'android' | 'web'
          product_id: string
          subscription_id: string
          transaction_id: string
          receipt_data: string
          status: 'active' | 'expired' | 'cancelled' | 'pending'
          tier: 'garage_visitor' | 'weekend_warrior' | 'master_tech'
          purchase_date: string
          expires_date: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          platform: 'ios' | 'android' | 'web'
          product_id: string
          subscription_id: string
          transaction_id: string
          receipt_data: string
          status?: 'active' | 'expired' | 'cancelled' | 'pending'
          tier: 'garage_visitor' | 'weekend_warrior' | 'master_tech'
          purchase_date: string
          expires_date: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: 'active' | 'expired' | 'cancelled' | 'pending'
          expires_date?: string
          updated_at?: string
        }
      }

      // Query logging for analytics
      query_logs: {
        Row: {
          id: string
          user_id: string
          question: string
          response: string
          vehicle_context?: Json
          response_time_ms?: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          question: string
          response: string
          vehicle_context?: Json
          response_time_ms?: number
          created_at?: string
        }
        Update: {
          response_time_ms?: number
        }
      }
    }
  }
}

// Additional type definitions for API requests/responses
export interface UnitPreferences {
  torque_unit: 'newton_meters' | 'pound_feet'
  pressure_unit: 'psi' | 'bar' | 'kilopascals'
  length_unit: 'metric' | 'imperial'
  volume_unit: 'metric' | 'imperial'
  temperature_unit: 'celsius' | 'fahrenheit'
  weight_unit: 'metric' | 'imperial'
  socket_unit: 'metric' | 'imperial'
  auto_play?: boolean | null
  voice_enabled?: boolean | null
  playback_speed?: number | null
}

export interface Vehicle {
  id: string
  user_id: string
  make: string
  model: string
  year: number
  trim?: string
  engine?: string
  nickname?: string
  notes?: string
  mileage?: number
  is_active?: boolean
  deactivated_at?: string
  deactivation_reason?: string
  last_used_at?: string
  created_at: string
  updated_at: string
}

export interface DocumentMetadata {
  id: string
  user_id: string
  filename: string
  original_filename: string
  file_size: number
  file_type: string
  document_type: 'service_manual' | 'repair_manual' | 'owners_manual' | 'parts_catalog' | 'wiring_diagram' | 'other'
  car_make?: string
  car_model?: string
  car_year?: number
  status: 'uploaded' | 'processing' | 'processed' | 'failed' | 'inactive'
  storage_path: string
  metadata: Json
  deactivated_at?: string
  deactivation_reason?: string
  created_at: string
  updated_at: string
}

export interface UsageStats {
  daily: {
    ask_count: number
    document_upload_count: number
    audio_count: number
    total_cost_cents: number
  }
  monthly: {
    ask_count: number
    document_upload_count: number
    audio_count: number
    total_cost_cents: number
  }
  limits: {
    maxDailyAsks?: number
    maxMonthlyAsks?: number
    maxDocumentUploads?: number
    maxVehicles?: number
    maxStorageMB?: number
  }
  resetTimes?: {
    dailyReset?: string
    monthlyReset?: string
  }
}

export interface SubscriptionStatus {
  tier: 'free_tier' | 'weekend_warrior' | 'master_tech'
  isActive: boolean
  expiresAt?: string
  platform?: 'ios' | 'android' | 'web'
  canUploadDocuments: boolean
  canAddVehicles: boolean
  dailyAsksRemaining?: number
  monthlyAsksRemaining?: number
  storageUsedMB: number
  storageAvailableMB?: number
}

export type UserTier = 'free_tier' | 'weekend_warrior' | 'master_tech'
export type DocumentType = 'service_manual' | 'repair_manual' | 'owners_manual' | 'parts_catalog' | 'wiring_diagram' | 'other'
export type DocumentStatus = 'uploaded' | 'processing' | 'processed' | 'failed' | 'inactive'
export type UsageType = 'ask' | 'document_upload' | 'audio_request'
export type Platform = 'ios' | 'android' | 'web'
export type SubscriptionTier = 'garage_visitor' | 'weekend_warrior' | 'master_tech'

export interface UnitPreferences {
  torque_unit: 'newton_meters' | 'pound_feet'
  pressure_unit: 'psi' | 'bar' | 'kilopascals'
  length_unit: 'metric' | 'imperial'
  volume_unit: 'metric' | 'imperial'
  temperature_unit: 'celsius' | 'fahrenheit'
  weight_unit: 'metric' | 'imperial'
  socket_unit: 'metric' | 'imperial'
}

export interface AskRequest {
  user_id: string
  question: string
  car?: string | null
  engine?: string | null
  notes?: string | null
  unit_preferences?: UnitPreferences | null
}

export interface AskResponse {
  answer: string
  audio_url?: string | null
}

export interface STTRequest {
  user_id: string
}

export interface TTSRequest {
  text: string
  user_id: string
  stability?: number
  similarity_boost?: number
  style?: number
  use_speaker_boost?: boolean
}

export type UserTier = 'free_tier' | 'weekend_warrior' | 'master_tech'

export type DocumentType =
  | 'user_upload'
  | 'bentley_manual'
  | 'haynes_manual'
  | 'fsm_official'
  | 'repair_guide'

export interface DocumentMetadata {
  id?: string
  user_id?: string | null
  title: string
  filename: string
  document_type: DocumentType
  car_make?: string | null
  car_model?: string | null
  car_year?: number | null
  car_engine?: string | null
  file_size: number
  page_count?: number | null
  storage_path?: string | null
  status: 'processing' | 'ready' | 'error'
  upload_date?: string | null
  processed_date?: string | null
  error_message?: string | null
  tags: string[]
  is_public: boolean
}

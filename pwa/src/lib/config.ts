// Configuration constants with environment variable fallbacks

export const config = {
  // OpenAI Configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
    organization: process.env.OPENAI_ORG_ID,
    project: process.env.OPENAI_PROJECT_ID,
    model: process.env.GPT_MODEL || 'gpt-4o',
    whisperModel: process.env.WHISPER_MODEL || 'whisper-1',
    maxTokens: parseInt(process.env.MAX_TOKENS || '500'),
    temperature: parseFloat(process.env.TEMPERATURE || '0.3'), // Lower for more focused responses
  },

  // ElevenLabs Configuration
  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY!,
    voiceId: process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB', // Adam voice
    modelId: process.env.ELEVENLABS_MODEL_ID || 'eleven_flash_v2_5', // Updated default to flash v2.5
    baseUrl: 'https://api.elevenlabs.io/v1',
  },

  // TTS Voice Settings - optimized for Flash v2.5
  tts: {
    stability: parseFloat(process.env.TTS_STABILITY || '0.65'), // Slightly higher for flash
    similarityBoost: parseFloat(process.env.TTS_SIMILARITY_BOOST || '0.85'), // Higher for flash
    style: parseFloat(process.env.TTS_STYLE || '0.2'), // Some style for naturalness
    useSpeakerBoost: false, // Flash v2.5 doesn't support speaker boost
  },

  // App Configuration
  app: {
    environment: process.env.ENVIRONMENT || 'development',
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
  },

  // Legacy prompt config - actual prompts now in prompts.ts
  prompts: {
    // This is kept for backward compatibility but actual prompts are in prompts.ts
    system: 'DEPRECATED - See prompts.ts for current system prompts',
  },

  // API Limits
  limits: {
    maxQuestionLength: 500,
    maxAudioSizeBytes: 25 * 1024 * 1024, // 25MB for audio files
    maxTTSCharacters: 40000, // Flash v2.5 supports up to 40k characters
  },

  // Enhanced AI Features
  ai: {
    useMultiAnswerEvaluation: process.env.USE_MULTI_ANSWER_EVALUATION !== 'false', // Default enabled
    evaluationIterations: parseInt(process.env.AI_EVALUATION_ITERATIONS || '3'),
    enableEnhancedSearch: process.env.ENABLE_ENHANCED_SEARCH !== 'false', // Default enabled
  }
} as const

// Validation function to check required environment variables
export function validateConfig() {
  const required = [
    'OPENAI_API_KEY',
    'ELEVENLABS_API_KEY',
    // Client-side Supabase variables
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    // Server-side Supabase variables
    'SUPABASE_SERVICE_ROLE_KEY',
  ]

  const missing = required.filter(key => !process.env[key])

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  // Optional but recommended OpenAI variables
  if (!process.env.OPENAI_ORG_ID) {
    console.warn('OPENAI_ORG_ID not set - requests may be limited')
  }
  if (!process.env.OPENAI_PROJECT_ID) {
    console.warn('OPENAI_PROJECT_ID not set - requests may be limited')
  }
}

// Voice ID options for easy switching
export const VOICE_OPTIONS = {
  ADAM: 'pNInz6obpgDQGcFmaJgB',
  ANTONI: 'ErXwobaYiN019PkySvjV',
  ARNOLD: '9PWcJUXOm9XVeKUEqN4L',
  BELLA: 'EXAVITQu4vr4xnSDxMaL',
  DOMI: 'AZnzlk1XvdvUeBnXmlld',
  ELLI: 'MF3mGyEYCl7XYWbV9V6O',
  JOSH: 'TxGEqnHWrfWFTfGW9XjX',
  RACHEL: '21m00Tcm4TlvDq8ikWAM',
  SAM: 'yoZ06aMxZJJ28mfd3POQ',
} as const

// User tiers for subscription management
export enum UserTier {
  FREE_TIER = 'free_tier',
  WEEKEND_WARRIOR = 'weekend_warrior',
  MASTER_TECH = 'master_tech'
}

// Tier limits type definition
export interface TierLimits {
  maxDailyAsks: number | null
  maxMonthlyAsks: number | null
  maxDocumentUploads: number | null
  maxVehicles: number | null
  maxStorageMB: number | null
  documentUploadEnabled: boolean
  ttsEnabled: boolean
  sttEnabled: boolean
}

// Tier limits configuration
export const TIER_LIMITS: Record<UserTier, TierLimits> = {
  [UserTier.FREE_TIER]: {
    maxDailyAsks: 3,
    maxMonthlyAsks: null,
    maxDocumentUploads: 0,
    maxVehicles: 1,
    maxStorageMB: 0,
    documentUploadEnabled: false,
    ttsEnabled: true,
    sttEnabled: true,
  },
  [UserTier.WEEKEND_WARRIOR]: {
    maxDailyAsks: null,
    maxMonthlyAsks: 50,
    maxDocumentUploads: 20,
    maxVehicles: null,
    maxStorageMB: 1000,
    documentUploadEnabled: true,
    ttsEnabled: true,
    sttEnabled: true,
  },
  [UserTier.MASTER_TECH]: {
    maxDailyAsks: null,
    maxMonthlyAsks: 200,
    maxDocumentUploads: null,
    maxVehicles: null,
    maxStorageMB: null,
    documentUploadEnabled: true,
    ttsEnabled: true,
    sttEnabled: true,
  }
} as const

// Model-specific optimization notes
export const MODEL_NOTES = {
  FLASH_V2_5: {
    advantages: ['Ultra-low latency (~75ms)', '50% cheaper', '40k character limit', '32 languages'],
    limitations: ['No speaker boost', 'Limited number normalization', 'Reduced emotional range'],
    bestFor: ['Conversational AI', 'Real-time applications', 'Bulk processing'],
  },
  MULTILINGUAL_V2: {
    advantages: ['Best quality', 'Rich emotional expression', 'Better number handling'],
    limitations: ['Higher cost', 'Higher latency', '10k character limit'],
    bestFor: ['Audiobooks', 'Professional content', 'Character voices'],
  }
} as const

-- Rename tts_requests to audio_requests and drop stt_requests
-- This consolidates audio usage tracking into a single clear column

-- Rename tts_requests column to audio_requests
ALTER TABLE public.daily_usage_stats
RENAME COLUMN tts_requests TO audio_requests;

-- Drop the unused stt_requests column
ALTER TABLE public.daily_usage_stats
DROP COLUMN IF EXISTS stt_requests;

-- Update any existing indexes that reference the old column name
DROP INDEX IF EXISTS idx_daily_usage_stats_tts_requests;
CREATE INDEX IF NOT EXISTS idx_daily_usage_stats_audio_requests
ON public.daily_usage_stats(audio_requests);

-- Add a comment for clarity
COMMENT ON COLUMN public.daily_usage_stats.audio_requests IS 'Combined TTS and STT requests for voice interactions';

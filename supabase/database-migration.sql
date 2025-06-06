-- Migration script to add general app settings to user_preferences table
-- Run this in your Supabase SQL editor or via CLI

-- Add the new columns for general app settings
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS auto_play BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS voice_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS playback_speed REAL DEFAULT 1.0;

-- Add comments to document the new columns
COMMENT ON COLUMN user_preferences.auto_play IS 'Whether audio responses should auto-play';
COMMENT ON COLUMN user_preferences.voice_enabled IS 'Whether voice input is enabled globally';
COMMENT ON COLUMN user_preferences.playback_speed IS 'Audio playback speed multiplier (0.5-2.0)';

-- Optional: Update existing rows to have the default values
-- (This is usually automatic with DEFAULT, but you can be explicit)
UPDATE user_preferences
SET
    auto_play = COALESCE(auto_play, true),
    voice_enabled = COALESCE(voice_enabled, true),
    playback_speed = COALESCE(playback_speed, 1.0)
WHERE auto_play IS NULL OR voice_enabled IS NULL OR playback_speed IS NULL;

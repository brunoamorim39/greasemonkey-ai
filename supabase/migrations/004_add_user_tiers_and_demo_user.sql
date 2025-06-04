-- Migration: Add user_tiers table and demo user
-- Created: 2024-01-XX
-- Purpose: Add missing user_tiers table and create demo user for development

-- =============================================================================
-- USER TIERS TABLE
-- =============================================================================

-- Create user_tiers table to track user subscription tiers
CREATE TABLE IF NOT EXISTS public.user_tiers (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier text NOT NULL CHECK (tier IN ('free_tier', 'weekend_warrior', 'master_tech')) DEFAULT 'free_tier',
  tier_override text CHECK (tier_override IN ('free_tier', 'weekend_warrior', 'master_tech')),
  tier_override_expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_tiers_user_id_unique UNIQUE (user_id)
);

-- Create user_preferences table for unit preferences
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  torque_unit text DEFAULT 'pound_feet' CHECK (torque_unit IN ('newton_meters', 'pound_feet', 'kilogram_meters')),
  pressure_unit text DEFAULT 'psi' CHECK (pressure_unit IN ('psi', 'bar', 'kpa')),
  length_unit text DEFAULT 'imperial' CHECK (length_unit IN ('metric', 'imperial')),
  volume_unit text DEFAULT 'imperial' CHECK (volume_unit IN ('metric', 'imperial')),
  temperature_unit text DEFAULT 'fahrenheit' CHECK (temperature_unit IN ('celsius', 'fahrenheit')),
  weight_unit text DEFAULT 'imperial' CHECK (weight_unit IN ('metric', 'imperial')),
  socket_unit text DEFAULT 'imperial' CHECK (socket_unit IN ('metric', 'imperial')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_preferences_user_id_unique UNIQUE (user_id)
);

-- =============================================================================
-- DEMO USER SETUP
-- =============================================================================

-- Insert demo user into auth.users if not exists
-- Note: In production, this would be handled by Supabase Auth
INSERT INTO auth.users (
  id,
  email,
  email_confirmed_at,
  created_at,
  updated_at,
  role,
  aud
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'demo@greasemonkey.ai',
  now(),
  now(),
  now(),
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Create user profile for demo user
INSERT INTO public.user_profiles (
  id,
  email,
  full_name,
  tier,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'demo@greasemonkey.ai',
  'Demo User',
  'free_tier',
  now(),
  now()
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  tier = EXCLUDED.tier,
  updated_at = now();

-- Create user tier for demo user
INSERT INTO public.user_tiers (
  user_id,
  tier,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'free_tier',
  now(),
  now()
) ON CONFLICT (user_id) DO UPDATE SET
  tier = EXCLUDED.tier,
  updated_at = now();

-- Create user preferences for demo user
INSERT INTO public.user_preferences (
  user_id,
  torque_unit,
  pressure_unit,
  length_unit,
  volume_unit,
  temperature_unit,
  weight_unit,
  socket_unit,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'pound_feet',
  'psi',
  'imperial',
  'imperial',
  'fahrenheit',
  'imperial',
  'imperial',
  now(),
  now()
) ON CONFLICT (user_id) DO UPDATE SET
  torque_unit = EXCLUDED.torque_unit,
  pressure_unit = EXCLUDED.pressure_unit,
  length_unit = EXCLUDED.length_unit,
  volume_unit = EXCLUDED.volume_unit,
  temperature_unit = EXCLUDED.temperature_unit,
  weight_unit = EXCLUDED.weight_unit,
  socket_unit = EXCLUDED.socket_unit,
  updated_at = now();

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_user_tiers_user_id ON public.user_tiers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on new tables
ALTER TABLE public.user_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- User tiers policies
DROP POLICY IF EXISTS "Users can view own tier" ON public.user_tiers;
CREATE POLICY "Users can view own tier" ON public.user_tiers
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can manage user tiers" ON public.user_tiers;
CREATE POLICY "System can manage user tiers" ON public.user_tiers
    FOR ALL WITH CHECK (true); -- Allow system to manage tiers

-- User preferences policies
DROP POLICY IF EXISTS "Users can manage own preferences" ON public.user_preferences;
CREATE POLICY "Users can manage own preferences" ON public.user_preferences
    FOR ALL USING (auth.uid() = user_id);

-- =============================================================================
-- FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_user_tiers_updated_at ON public.user_tiers;
CREATE TRIGGER update_user_tiers_updated_at
    BEFORE UPDATE ON public.user_tiers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE public.user_tiers IS 'User subscription tiers and overrides';
COMMENT ON TABLE public.user_preferences IS 'User preferences for units and settings';
COMMENT ON COLUMN public.user_tiers.tier IS 'Base subscription tier';
COMMENT ON COLUMN public.user_tiers.tier_override IS 'Temporary tier override for testing';
COMMENT ON COLUMN public.user_tiers.tier_override_expires_at IS 'When the tier override expires';

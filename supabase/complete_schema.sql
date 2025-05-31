-- GreaseMonkey AI Complete Database Schema
-- This file contains the complete schema for a fresh Supabase setup
-- Run this if you're setting up the database from scratch

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- CORE TABLES (existing)
-- =============================================================================

-- Users table
CREATE TABLE IF NOT EXISTS public.users (
  user_id uuid NOT NULL,
  email text UNIQUE,
  garage jsonb DEFAULT '[]'::jsonb,
  tier text DEFAULT 'free'::text,
  created_at timestamp with time zone DEFAULT now(),
  last_active timestamp with time zone,
  CONSTRAINT users_pkey PRIMARY KEY (user_id)
);

-- Queries table
CREATE TABLE IF NOT EXISTS public.queries (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid REFERENCES public.users(user_id) ON DELETE CASCADE,
  question text NOT NULL,
  response text,
  car_year integer,
  car_make text,
  car_model text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT queries_pkey PRIMARY KEY (id)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Performance indexes for common queries
CREATE INDEX IF NOT EXISTS idx_queries_user_id ON public.queries(user_id);
CREATE INDEX IF NOT EXISTS idx_queries_created_at ON public.queries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON public.users(last_active);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queries ENABLE ROW LEVEL SECURITY;

-- Users table policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Queries table policies
DROP POLICY IF EXISTS "Users can view own queries" ON public.queries;
CREATE POLICY "Users can view own queries" ON public.queries
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own queries" ON public.queries;
CREATE POLICY "Users can insert own queries" ON public.queries
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Function to update last_active timestamp
CREATE OR REPLACE FUNCTION update_last_active()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.users
    SET last_active = NOW()
    WHERE user_id = auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update last_active when user makes a query
DROP TRIGGER IF EXISTS trigger_update_last_active ON public.queries;
CREATE TRIGGER trigger_update_last_active
    AFTER INSERT ON public.queries
    FOR EACH ROW
    EXECUTE FUNCTION update_last_active();

-- =============================================================================
-- SAMPLE DATA (Optional - for testing)
-- =============================================================================

-- Note: In production, remove this section or comment it out
-- This is useful for development and testing

-- Sample user (replace with actual UUID from auth.users after signup)
-- INSERT INTO public.users (user_id, email, tier)
-- VALUES ('00000000-0000-0000-0000-000000000000', 'test@example.com', 'free')
-- ON CONFLICT (user_id) DO NOTHING;

-- Sample query
-- INSERT INTO public.queries (user_id, question, response, car_year, car_make, car_model)
-- VALUES (
--     '00000000-0000-0000-0000-000000000000',
--     'My 2018 Honda Civic is making a grinding noise when I brake. What could be wrong?',
--     'Based on your description, the grinding noise when braking is likely due to worn brake pads...',
--     2018,
--     'Honda',
--     'Civic'
-- ) ON CONFLICT DO NOTHING;

-- =============================================================================
-- ADMIN HELPERS (Optional)
-- =============================================================================

-- Function to get user stats (admin only)
CREATE OR REPLACE FUNCTION get_user_stats()
RETURNS TABLE (
    total_users bigint,
    active_users_last_30_days bigint,
    total_queries bigint,
    queries_last_30_days bigint
)
LANGUAGE sql SECURITY DEFINER
AS $$
    SELECT
        (SELECT COUNT(*) FROM public.users) as total_users,
        (SELECT COUNT(*) FROM public.users WHERE last_active > NOW() - INTERVAL '30 days') as active_users_last_30_days,
        (SELECT COUNT(*) FROM public.queries) as total_queries,
        (SELECT COUNT(*) FROM public.queries WHERE created_at > NOW() - INTERVAL '30 days') as queries_last_30_days;
$$;

-- Grant execute permission to authenticated users
-- (You might want to restrict this to admin users only)
GRANT EXECUTE ON FUNCTION get_user_stats() TO authenticated;

-- =============================================================================
-- NOTES
-- =============================================================================

-- Feedback System: GreaseMonkey AI uses Ybug (external service) for feedback management
-- - No database tables needed for feedback
-- - Creates GitHub issues directly
-- - Zero infrastructure cost
-- - Professional issue tracking workflow
-- - Access via WebView in app settings

-- User Tiers: 'free', 'premium', 'admin'
-- - free: Basic features
-- - premium: Advanced features (future)
-- - admin: Access to admin functions and user management

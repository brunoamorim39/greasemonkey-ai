-- Feedback and Support Tables for GreaseMonkey AI
-- Add these tables to your Supabase database

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- FEEDBACK TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('bug', 'feature', 'general')),
  subject text NOT NULL,
  description text NOT NULL,
  email text,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  reproduction_steps text,
  expected_behavior text,
  actual_behavior text,
  urgency text DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high')),
  system_info jsonb NOT NULL,
  status text DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  admin_response text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- =============================================================================
-- SUPPORT TICKETS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id text PRIMARY KEY, -- Using custom ticket ID format
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category text NOT NULL CHECK (category IN ('technical', 'billing', 'account', 'feature', 'other')),
  priority text NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  subject text NOT NULL,
  description text NOT NULL,
  email text NOT NULL,
  phone text,
  preferred_contact text NOT NULL CHECK (preferred_contact IN ('email', 'phone')),
  system_info jsonb NOT NULL,
  status text DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  admin_response text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON public.feedback(type);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON public.feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_urgency ON public.feedback(urgency);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON public.support_tickets(category);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON public.support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets(created_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role bypass" ON public.feedback;
DROP POLICY IF EXISTS "Service role bypass support" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can insert own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can view own support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can insert own support tickets" ON public.support_tickets;

-- Allow service role to bypass RLS (for API routes)
CREATE POLICY "Service role bypass" ON public.feedback
  FOR ALL USING (
    current_setting('role') = 'service_role'
  );

CREATE POLICY "Service role bypass support" ON public.support_tickets
  FOR ALL USING (
    current_setting('role') = 'service_role'
  );

-- Users can view their own feedback (for direct client access)
CREATE POLICY "Users can view own feedback" ON public.feedback
  FOR SELECT USING (auth.uid() = user_id);

-- Users can view their own support tickets (for direct client access)
CREATE POLICY "Users can view own support tickets" ON public.support_tickets
  FOR SELECT USING (auth.uid() = user_id);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_feedback_updated_at ON public.feedback;
DROP TRIGGER IF EXISTS update_support_tickets_updated_at ON public.support_tickets;

-- Add updated_at triggers
CREATE TRIGGER update_feedback_updated_at
  BEFORE UPDATE ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- GreaseMonkey AI Fresh Schema
-- Run this in your Supabase SQL Editor to set up the database

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- AUTHENTICATION SETUP
-- =============================================================================

-- Enable authentication (Supabase handles this automatically)
-- Users will be stored in auth.users table

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- User profiles table (extends auth.users)
CREATE TABLE public.user_profiles (
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email text,
  full_name text,
  tier text NOT NULL DEFAULT 'free_tier' CHECK (tier IN ('free_tier', 'weekend_warrior', 'master_tech')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Vehicles table
CREATE TABLE public.vehicles (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  make text NOT NULL,
  model text NOT NULL,
  year integer NOT NULL,
  trim text,
  engine text,
  nickname text,
  vin text,
  notes text,
  mileage integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Documents table
CREATE TABLE public.documents (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  filename text NOT NULL,
  original_filename text NOT NULL,
  category text NOT NULL CHECK (category IN (
    'service_manual',
    'owner_manual',
    'maintenance_record',
    'parts_diagram',
    'photo',
    'video',
    'other'
  )),
  description text,
  file_size_bytes bigint NOT NULL,
  storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'processed', 'error')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Usage tracking table
CREATE TABLE public.usage_logs (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('question', 'document_upload', 'audio_request')),
  cost_cents integer DEFAULT 0, -- For weekend_warrior pay-per-use
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now()
);

-- Conversation history table
CREATE TABLE public.conversations (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  question text NOT NULL,
  answer text NOT NULL,
  audio_url text,
  created_at timestamp with time zone DEFAULT now()
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

CREATE INDEX idx_vehicles_user_id ON public.vehicles(user_id);
CREATE INDEX idx_documents_user_id ON public.documents(user_id);
CREATE INDEX idx_documents_vehicle_id ON public.documents(vehicle_id);
CREATE INDEX idx_usage_logs_user_id ON public.usage_logs(user_id);
CREATE INDEX idx_usage_logs_created_at ON public.usage_logs(created_at DESC);
CREATE INDEX idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX idx_conversations_vehicle_id ON public.conversations(vehicle_id);
CREATE INDEX idx_conversations_created_at ON public.conversations(created_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Vehicles policies
CREATE POLICY "Users can manage own vehicles" ON public.vehicles
  FOR ALL USING (auth.uid() = user_id);

-- Documents policies
CREATE POLICY "Users can manage own documents" ON public.documents
  FOR ALL USING (auth.uid() = user_id);

-- Usage logs policies
CREATE POLICY "Users can view own usage" ON public.usage_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert usage logs" ON public.usage_logs
  FOR INSERT WITH CHECK (true); -- Allow system to log usage

-- Conversations policies
CREATE POLICY "Users can manage own conversations" ON public.conversations
  FOR ALL USING (auth.uid() = user_id);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- USAGE TRACKING FUNCTIONS
-- =============================================================================

-- Function to check daily question limit for free tier
CREATE OR REPLACE FUNCTION check_daily_question_limit(user_uuid uuid)
RETURNS boolean AS $$
DECLARE
  user_tier text;
  today_questions integer;
BEGIN
  -- Get user tier
  SELECT tier INTO user_tier FROM public.user_profiles WHERE id = user_uuid;

  -- Only check for free tier
  IF user_tier != 'free_tier' THEN
    RETURN true;
  END IF;

  -- Count today's questions
  SELECT COUNT(*) INTO today_questions
  FROM public.usage_logs
  WHERE user_id = user_uuid
    AND action_type = 'question'
    AND created_at >= CURRENT_DATE;

  -- Free tier: 3 questions per day
  RETURN today_questions < 3;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check monthly question limit for master_tech
CREATE OR REPLACE FUNCTION check_monthly_question_limit(user_uuid uuid)
RETURNS boolean AS $$
DECLARE
  user_tier text;
  month_questions integer;
BEGIN
  -- Get user tier
  SELECT tier INTO user_tier FROM public.user_profiles WHERE id = user_uuid;

  -- Only check for master_tech tier
  IF user_tier != 'master_tech' THEN
    RETURN true;
  END IF;

  -- Count this month's questions
  SELECT COUNT(*) INTO month_questions
  FROM public.usage_logs
  WHERE user_id = user_uuid
    AND action_type = 'question'
    AND created_at >= date_trunc('month', CURRENT_DATE);

  -- Master tech: 100 questions per month
  RETURN month_questions < 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log usage
CREATE OR REPLACE FUNCTION log_usage(
  user_uuid uuid,
  action text,
  cost integer DEFAULT 0,
  meta jsonb DEFAULT '{}'
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.usage_logs (user_id, action_type, cost_cents, metadata)
  VALUES (user_uuid, action, cost, meta);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STORAGE SETUP
-- =============================================================================

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for documents bucket
CREATE POLICY "Users can upload own documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own documents" ON storage.objects
  FOR DELETE USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

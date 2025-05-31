-- GreaseMonkey AI - Existing Schema
-- This file documents the current database structure

-- Users table (existing)
CREATE TABLE public.users (
  user_id uuid NOT NULL,
  email text UNIQUE,
  garage jsonb DEFAULT '[]'::jsonb,
  tier text DEFAULT 'free'::text,
  created_at timestamp with time zone DEFAULT now(),
  last_active timestamp with time zone,
  CONSTRAINT users_pkey PRIMARY KEY (user_id)
);

-- Queries table (existing)
CREATE TABLE public.queries (
  id bigint NOT NULL DEFAULT nextval('queries_id_seq'::regclass),
  user_id uuid,
  question text NOT NULL,
  response text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  car text,
  engine text,
  notes text,
  source text,
  audio_url text,
  error text,
  CONSTRAINT queries_pkey PRIMARY KEY (id),
  CONSTRAINT queries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id)
);

-- Indexes for existing tables (if not already present)
CREATE INDEX IF NOT EXISTS idx_queries_user_id ON public.queries(user_id);
CREATE INDEX IF NOT EXISTS idx_queries_created_at ON public.queries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON public.users(last_active);

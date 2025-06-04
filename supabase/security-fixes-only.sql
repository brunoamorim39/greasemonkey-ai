-- GreaseMonkey AI - Security Fixes Only
-- Run this if you already have the tables set up

-- =============================================================================
-- FUNCTION SECURITY FIXES
-- =============================================================================

-- Fix: Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix: Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix: Function to check daily question limit for free tier
CREATE OR REPLACE FUNCTION public.check_daily_question_limit(user_uuid uuid)
RETURNS boolean
SET search_path = ''
AS $$
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

-- Fix: Function to check monthly question limit for master_tech
CREATE OR REPLACE FUNCTION public.check_monthly_question_limit(user_uuid uuid)
RETURNS boolean
SET search_path = ''
AS $$
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

-- Fix: Function to log usage
CREATE OR REPLACE FUNCTION public.log_usage(
  user_uuid uuid,
  action text,
  cost integer DEFAULT 0,
  meta jsonb DEFAULT '{}'
)
RETURNS void
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.usage_logs (user_id, action_type, cost_cents, metadata)
  VALUES (user_uuid, action, cost, meta);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- CLEANUP OLD FUNCTIONS (if they exist from previous schemas)
-- =============================================================================

DROP FUNCTION IF EXISTS public.increment_vote_count;
DROP FUNCTION IF EXISTS public.decrement_vote_count;
DROP FUNCTION IF EXISTS public.can_user_perform_action;
DROP FUNCTION IF EXISTS public.get_user_subscription_tier;
DROP FUNCTION IF EXISTS public.update_subscription_from_receipt;

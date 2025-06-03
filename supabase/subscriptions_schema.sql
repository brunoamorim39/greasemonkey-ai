-- Subscription Management Schema
-- Add this to your existing Supabase database

-- =============================================================================
-- SUBSCRIPTION TABLES
-- =============================================================================

-- User subscriptions table
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid REFERENCES public.users(user_id) ON DELETE CASCADE,
  subscription_tier text NOT NULL, -- 'garage_visitor', 'gearhead', 'master_tech'
  platform text NOT NULL, -- 'ios', 'android', 'web'
  platform_subscription_id text, -- App Store/Play Store subscription ID
  product_id text NOT NULL, -- Product ID from app stores
  status text NOT NULL DEFAULT 'active', -- 'active', 'cancelled', 'expired', 'paused'
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT unique_user_active_subscription UNIQUE (user_id, status) DEFERRABLE INITIALLY DEFERRED
);

-- Payment receipts table for verification
CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid REFERENCES public.users(user_id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.user_subscriptions(id) ON DELETE CASCADE,
  platform text NOT NULL, -- 'ios', 'android'
  transaction_id text NOT NULL, -- App Store transaction ID or Play Store order ID
  original_transaction_id text, -- For renewals
  receipt_data text NOT NULL, -- Raw receipt data
  receipt_verified boolean DEFAULT false,
  verification_date timestamp with time zone,
  amount_cents integer, -- Price in cents
  currency text DEFAULT 'USD',
  purchase_date timestamp with time zone,
  expires_date timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payment_receipts_pkey PRIMARY KEY (id),
  CONSTRAINT unique_transaction_id UNIQUE (platform, transaction_id)
);

-- Usage limits and tracking (extends existing usage system)
CREATE TABLE IF NOT EXISTS public.subscription_usage (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid REFERENCES public.users(user_id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.user_subscriptions(id) ON DELETE CASCADE,
  period_start timestamp with time zone NOT NULL,
  period_end timestamp with time zone NOT NULL,
  questions_used integer DEFAULT 0,
  vehicles_count integer DEFAULT 0,
  documents_uploaded integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT subscription_usage_pkey PRIMARY KEY (id),
  CONSTRAINT unique_user_period UNIQUE (user_id, period_start, period_end)
);

-- App Store/Play Store webhook events
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  platform text NOT NULL, -- 'ios', 'android'
  event_type text NOT NULL, -- 'purchase', 'cancel', 'renewal', 'refund', etc.
  subscription_id text, -- Platform subscription ID
  user_id uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  raw_payload jsonb NOT NULL,
  processed boolean DEFAULT false,
  processed_at timestamp with time zone,
  error_message text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT webhook_events_pkey PRIMARY KEY (id)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_platform_id ON public.user_subscriptions(platform_subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_user_id ON public.payment_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_transaction_id ON public.payment_receipts(transaction_id);
CREATE INDEX IF NOT EXISTS idx_subscription_usage_user_id ON public.subscription_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_platform ON public.webhook_events(platform);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON public.webhook_events(processed);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- User subscriptions policies
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.user_subscriptions;
CREATE POLICY "Users can view own subscriptions" ON public.user_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

-- Payment receipts policies
DROP POLICY IF EXISTS "Users can view own receipts" ON public.payment_receipts;
CREATE POLICY "Users can view own receipts" ON public.payment_receipts
    FOR SELECT USING (auth.uid() = user_id);

-- Subscription usage policies
DROP POLICY IF EXISTS "Users can view own usage" ON public.subscription_usage;
CREATE POLICY "Users can view own usage" ON public.subscription_usage
    FOR SELECT USING (auth.uid() = user_id);

-- Webhook events - admin only (no user access)
DROP POLICY IF EXISTS "No user access to webhooks" ON public.webhook_events;
CREATE POLICY "No user access to webhooks" ON public.webhook_events
    FOR ALL USING (false);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to get user's current subscription tier
CREATE OR REPLACE FUNCTION get_user_subscription_tier(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    current_tier text;
BEGIN
    SELECT subscription_tier INTO current_tier
    FROM public.user_subscriptions
    WHERE user_id = p_user_id
    AND status = 'active'
    AND (current_period_end IS NULL OR current_period_end > now())
    ORDER BY created_at DESC
    LIMIT 1;

    -- If no active subscription, return free tier
    RETURN COALESCE(current_tier, 'garage_visitor');
END;
$$;

-- Function to check if user can perform action based on subscription
CREATE OR REPLACE FUNCTION can_user_perform_action(
    p_user_id uuid,
    p_action text -- 'ask_question', 'upload_document', 'add_vehicle'
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    user_tier text;
    current_usage record;
    can_perform boolean := false;
BEGIN
    -- Get user's current tier
    SELECT get_user_subscription_tier(p_user_id) INTO user_tier;

    -- Get current period usage
    SELECT * INTO current_usage
    FROM public.subscription_usage
    WHERE user_id = p_user_id
    AND period_start <= now()
    AND period_end >= now()
    ORDER BY created_at DESC
    LIMIT 1;

    -- If no usage record for current period, create one
    IF current_usage IS NULL THEN
        INSERT INTO public.subscription_usage (
            user_id,
            period_start,
            period_end,
            questions_used,
            vehicles_count,
            documents_uploaded
        ) VALUES (
            p_user_id,
            date_trunc('day', now()),
            date_trunc('day', now()) + interval '1 day',
            0, 0, 0
        ) RETURNING * INTO current_usage;
    END IF;

    -- Check limits based on tier and action
    CASE user_tier
        WHEN 'garage_visitor' THEN
            CASE p_action
                WHEN 'ask_question' THEN
                    can_perform := current_usage.questions_used < 3;
                WHEN 'add_vehicle' THEN
                    can_perform := current_usage.vehicles_count < 1;
                WHEN 'upload_document' THEN
                    can_perform := false; -- No document uploads for free tier
                ELSE
                    can_perform := false;
            END CASE;
        WHEN 'gearhead' THEN
            CASE p_action
                WHEN 'ask_question' THEN
                    can_perform := true; -- Unlimited
                WHEN 'add_vehicle' THEN
                    can_perform := true; -- Unlimited
                WHEN 'upload_document' THEN
                    can_perform := current_usage.documents_uploaded < 20;
                ELSE
                    can_perform := true;
            END CASE;
        WHEN 'master_tech' THEN
            can_perform := true; -- Unlimited everything
        ELSE
            can_perform := false;
    END CASE;

    RETURN can_perform;
END;
$$;

-- Function to update subscription from receipt verification
CREATE OR REPLACE FUNCTION update_subscription_from_receipt(
    p_user_id uuid,
    p_platform text,
    p_transaction_id text,
    p_product_id text,
    p_receipt_data text,
    p_purchase_date timestamp with time zone,
    p_expires_date timestamp with time zone
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    subscription_id uuid;
    receipt_id uuid;
    tier_name text;
BEGIN
    -- Determine tier from product ID
    CASE p_product_id
        WHEN 'gearhead_monthly_499', 'gearhead_yearly_4990' THEN
            tier_name := 'gearhead';
        WHEN 'mastertech_monthly_2999', 'mastertech_yearly_29990' THEN
            tier_name := 'master_tech';
        ELSE
            tier_name := 'garage_visitor';
    END CASE;

    -- Insert or update subscription
    INSERT INTO public.user_subscriptions (
        user_id,
        subscription_tier,
        platform,
        platform_subscription_id,
        product_id,
        status,
        current_period_start,
        current_period_end
    ) VALUES (
        p_user_id,
        tier_name,
        p_platform,
        p_transaction_id,
        p_product_id,
        'active',
        p_purchase_date,
        p_expires_date
    ) ON CONFLICT (user_id, status) DO UPDATE SET
        subscription_tier = tier_name,
        platform_subscription_id = p_transaction_id,
        product_id = p_product_id,
        current_period_start = p_purchase_date,
        current_period_end = p_expires_date,
        updated_at = now()
    RETURNING id INTO subscription_id;

    -- Store receipt
    INSERT INTO public.payment_receipts (
        user_id,
        subscription_id,
        platform,
        transaction_id,
        receipt_data,
        receipt_verified,
        verification_date,
        purchase_date,
        expires_date
    ) VALUES (
        p_user_id,
        subscription_id,
        p_platform,
        p_transaction_id,
        p_receipt_data,
        true,
        now(),
        p_purchase_date,
        p_expires_date
    ) ON CONFLICT (platform, transaction_id) DO UPDATE SET
        receipt_verified = true,
        verification_date = now()
    RETURNING id INTO receipt_id;

    -- Update user tier in users table
    UPDATE public.users
    SET tier = tier_name
    WHERE user_id = p_user_id;

    RETURN subscription_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_subscription_tier(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION can_user_perform_action(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION update_subscription_from_receipt(uuid, text, text, text, text, timestamp with time zone, timestamp with time zone) TO service_role;

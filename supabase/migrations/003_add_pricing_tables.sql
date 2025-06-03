-- Migration: Add pricing and usage tracking tables
-- Created: 2024-01-XX
-- Purpose: Add comprehensive usage tracking and pricing tier support

-- =============================================================================
-- USAGE TRACKING TABLES
-- =============================================================================

-- Usage records table - tracks individual usage events
CREATE TABLE IF NOT EXISTS public.usage_records (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  usage_type text NOT NULL CHECK (usage_type IN ('ask_query', 'document_upload', 'document_search', 'tts_request', 'stt_request')),
  timestamp timestamp with time zone DEFAULT now() NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  cost_cents integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT usage_records_pkey PRIMARY KEY (id)
);

-- Daily usage statistics table - aggregated daily stats per user
CREATE TABLE IF NOT EXISTS public.daily_usage_stats (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  date date NOT NULL,
  ask_queries integer DEFAULT 0,
  document_uploads integer DEFAULT 0,
  document_searches integer DEFAULT 0,
  tts_requests integer DEFAULT 0,
  stt_requests integer DEFAULT 0,
  total_cost_cents integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT daily_usage_stats_pkey PRIMARY KEY (id),
  CONSTRAINT daily_usage_stats_user_date_unique UNIQUE (user_id, date)
);

-- Tier overrides table - for testing/admin purposes
CREATE TABLE IF NOT EXISTS public.tier_overrides (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  override_tier text NOT NULL CHECK (override_tier IN ('free', 'usage_paid', 'fixed_rate')),
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid, -- Could reference admin user who created the override
  CONSTRAINT tier_overrides_pkey PRIMARY KEY (id)
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Usage records indexes
CREATE INDEX IF NOT EXISTS idx_usage_records_user_id ON public.usage_records(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_timestamp ON public.usage_records(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_usage_records_usage_type ON public.usage_records(usage_type);
CREATE INDEX IF NOT EXISTS idx_usage_records_user_timestamp ON public.usage_records(user_id, timestamp DESC);

-- Daily usage stats indexes
CREATE INDEX IF NOT EXISTS idx_daily_usage_stats_user_id ON public.daily_usage_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_usage_stats_date ON public.daily_usage_stats(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_usage_stats_user_date ON public.daily_usage_stats(user_id, date DESC);

-- Tier overrides indexes
CREATE INDEX IF NOT EXISTS idx_tier_overrides_user_id ON public.tier_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_tier_overrides_expires_at ON public.tier_overrides(expires_at);
CREATE INDEX IF NOT EXISTS idx_tier_overrides_active ON public.tier_overrides(user_id, expires_at) WHERE expires_at > now();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on new tables
ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tier_overrides ENABLE ROW LEVEL SECURITY;

-- Usage records policies
DROP POLICY IF EXISTS "Users can view own usage records" ON public.usage_records;
CREATE POLICY "Users can view own usage records" ON public.usage_records
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert usage records" ON public.usage_records;
CREATE POLICY "System can insert usage records" ON public.usage_records
    FOR INSERT WITH CHECK (true); -- Allow system to insert for any user

-- Daily usage stats policies
DROP POLICY IF EXISTS "Users can view own usage stats" ON public.daily_usage_stats;
CREATE POLICY "Users can view own usage stats" ON public.daily_usage_stats
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can manage usage stats" ON public.daily_usage_stats;
CREATE POLICY "System can manage usage stats" ON public.daily_usage_stats
    FOR ALL WITH CHECK (true); -- Allow system to manage stats for any user

-- Tier overrides policies (admin only)
DROP POLICY IF EXISTS "Admins can view tier overrides" ON public.tier_overrides;
CREATE POLICY "Admins can view tier overrides" ON public.tier_overrides
    FOR SELECT USING (true); -- For now, allow all - can be restricted to admin role later

DROP POLICY IF EXISTS "Admins can manage tier overrides" ON public.tier_overrides;
CREATE POLICY "Admins can manage tier overrides" ON public.tier_overrides
    FOR ALL WITH CHECK (true); -- For now, allow all - can be restricted to admin role later

-- =============================================================================
-- FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Function to update the updated_at timestamp on daily_usage_stats
CREATE OR REPLACE FUNCTION update_daily_usage_stats_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_daily_usage_stats_updated_at ON public.daily_usage_stats;
CREATE TRIGGER trigger_daily_usage_stats_updated_at
    BEFORE UPDATE ON public.daily_usage_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_usage_stats_timestamp();

-- Function to clean up expired tier overrides (can be called via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_tier_overrides()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.tier_overrides
    WHERE expires_at < NOW();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's current effective tier (including overrides)
CREATE OR REPLACE FUNCTION get_user_effective_tier(input_user_id uuid)
RETURNS text AS $$
DECLARE
    override_tier text;
    base_tier text;
BEGIN
    -- Check for active tier override
    SELECT tier_overrides.override_tier INTO override_tier
    FROM public.tier_overrides
    WHERE tier_overrides.user_id = input_user_id
      AND tier_overrides.expires_at > NOW()
    ORDER BY tier_overrides.created_at DESC
    LIMIT 1;

    -- If override exists, return it
    IF override_tier IS NOT NULL THEN
        RETURN override_tier;
    END IF;

    -- Otherwise return base tier
    SELECT users.tier INTO base_tier
    FROM public.users
    WHERE users.user_id = input_user_id;

    RETURN COALESCE(base_tier, 'free');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- HELPFUL VIEWS (Optional)
-- =============================================================================

-- View for user usage summary with tier information
CREATE OR REPLACE VIEW user_usage_summary AS
SELECT
    u.user_id,
    u.email,
    get_user_effective_tier(u.user_id) as effective_tier,
    u.tier as base_tier,
    COALESCE(dus.ask_queries, 0) as today_asks,
    COALESCE(dus.document_uploads, 0) as today_uploads,
    COALESCE(dus.total_cost_cents, 0) as today_cost_cents,
    u.created_at as user_created_at,
    u.last_active
FROM public.users u
LEFT JOIN public.daily_usage_stats dus ON (
    u.user_id = dus.user_id
    AND dus.date = CURRENT_DATE
);

-- Grant access to the view
GRANT SELECT ON user_usage_summary TO authenticated;

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE public.usage_records IS 'Individual usage events for billing and analytics';
COMMENT ON TABLE public.daily_usage_stats IS 'Aggregated daily usage statistics per user';
COMMENT ON TABLE public.tier_overrides IS 'Temporary tier overrides for testing and admin purposes';

COMMENT ON COLUMN public.usage_records.cost_cents IS 'Cost in cents for usage-based billing';
COMMENT ON COLUMN public.usage_records.details IS 'Additional metadata about the usage event';
COMMENT ON COLUMN public.daily_usage_stats.total_cost_cents IS 'Total cost in cents for the day';
COMMENT ON COLUMN public.tier_overrides.expires_at IS 'When the tier override expires';

COMMENT ON FUNCTION get_user_effective_tier(uuid) IS 'Returns user effective tier considering active overrides';
COMMENT ON FUNCTION cleanup_expired_tier_overrides() IS 'Removes expired tier overrides - call via cron job';

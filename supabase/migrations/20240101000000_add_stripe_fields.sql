-- Add Stripe-related fields to user_profiles table
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS stripe_payment_method_id text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'none';
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS subscription_id text;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS subscription_start_date timestamptz;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS subscription_end_date timestamptz;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer_id ON public.user_profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription_status ON public.user_profiles(subscription_status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription_id ON public.user_profiles(subscription_id);

-- Update usage_logs table to match usage_records expected by backend
-- Rename to usage_records and add missing fields if they don't exist
DO $$
BEGIN
    -- Check if usage_records table exists, if not rename usage_logs
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'usage_records') THEN
        -- Add missing columns to usage_logs first
        ALTER TABLE public.usage_logs ADD COLUMN IF NOT EXISTS usage_type text;
        ALTER TABLE public.usage_logs ADD COLUMN IF NOT EXISTS details jsonb DEFAULT '{}';
        ALTER TABLE public.usage_logs ADD COLUMN IF NOT EXISTS timestamp timestamptz DEFAULT now();

        -- Update existing data to match new schema
        UPDATE public.usage_logs
        SET usage_type = action_type,
            details = metadata,
            timestamp = created_at
        WHERE usage_type IS NULL;

        -- Rename the table
        ALTER TABLE public.usage_logs RENAME TO usage_records;

        -- Update the constraint name
        ALTER TABLE public.usage_records RENAME CONSTRAINT usage_logs_pkey TO usage_records_pkey;
        ALTER TABLE public.usage_records RENAME CONSTRAINT usage_logs_user_id_fkey TO usage_records_user_id_fkey;
    END IF;
END $$;

-- Create daily_usage_stats table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.daily_usage_stats (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    date date NOT NULL,
    ask_queries integer DEFAULT 0,
    document_uploads integer DEFAULT 0,
    document_searches integer DEFAULT 0,
    tts_requests integer DEFAULT 0,
    stt_requests integer DEFAULT 0,
    total_cost_cents integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT daily_usage_stats_pkey PRIMARY KEY (id),
    CONSTRAINT daily_usage_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
    CONSTRAINT daily_usage_stats_user_date_unique UNIQUE (user_id, date)
);

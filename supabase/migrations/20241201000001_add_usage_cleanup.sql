-- Usage data cleanup functions
-- Clean up old usage data to prevent infinite database growth

-- Function to clean up old daily usage stats (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_daily_usage_stats()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
    cutoff_date DATE;
BEGIN
    -- Keep last 90 days of data
    cutoff_date := CURRENT_DATE - INTERVAL '90 days';

    DELETE FROM public.daily_usage_stats
    WHERE date < cutoff_date;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old usage records (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_usage_records()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
    cutoff_timestamp TIMESTAMPTZ;
BEGIN
    -- Keep last 90 days of data
    cutoff_timestamp := NOW() - INTERVAL '90 days';

    DELETE FROM public.usage_records
    WHERE timestamp < cutoff_timestamp;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old query logs (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_query_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
    cutoff_timestamp TIMESTAMPTZ;
BEGIN
    -- Keep last 30 days of query logs
    cutoff_timestamp := NOW() - INTERVAL '30 days';

    DELETE FROM public.query_logs
    WHERE created_at < cutoff_timestamp;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Master cleanup function that calls all cleanup functions
CREATE OR REPLACE FUNCTION cleanup_old_usage_data()
RETURNS TABLE(
    daily_stats_deleted INTEGER,
    usage_records_deleted INTEGER,
    query_logs_deleted INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cleanup_old_daily_usage_stats() as daily_stats_deleted,
        cleanup_old_usage_records() as usage_records_deleted,
        cleanup_old_query_logs() as query_logs_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON FUNCTION cleanup_old_daily_usage_stats() IS 'Removes daily usage statistics older than 90 days';
COMMENT ON FUNCTION cleanup_old_usage_records() IS 'Removes individual usage records older than 90 days';
COMMENT ON FUNCTION cleanup_old_query_logs() IS 'Removes query logs older than 30 days';
COMMENT ON FUNCTION cleanup_old_usage_data() IS 'Master cleanup function that removes all old usage data';

-- You can set up a cron job to run this periodically:
-- SELECT cron.schedule('cleanup-usage-data', '0 2 * * *', 'SELECT cleanup_old_usage_data();');

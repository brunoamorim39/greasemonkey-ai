-- GreaseMonkey AI Feedback System Schema for Supabase
-- This file contains the database schema for bug reports and feature requests

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Bug Reports Table
CREATE TABLE IF NOT EXISTS bug_reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT NOT NULL,
    vehicle_info TEXT,
    steps_to_reproduce TEXT[] DEFAULT '{}',
    expected_behavior TEXT,
    actual_behavior TEXT,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    admin_response TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feature Requests Table
CREATE TABLE IF NOT EXISTS feature_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    priority TEXT NOT NULL,
    use_case TEXT,
    current_workaround TEXT,
    vote_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'planned', 'in_progress', 'completed', 'rejected')),
    admin_response TEXT,
    estimated_timeframe TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feature Votes Table (for tracking user votes)
CREATE TABLE IF NOT EXISTS feature_votes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    feature_request_id UUID NOT NULL REFERENCES feature_requests(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, feature_request_id)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bug_reports_user_id ON bug_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at ON bug_reports(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feature_requests_user_id ON feature_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_requests_status ON feature_requests(status);
CREATE INDEX IF NOT EXISTS idx_feature_requests_vote_count ON feature_requests(vote_count DESC);
CREATE INDEX IF NOT EXISTS idx_feature_requests_created_at ON feature_requests(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feature_votes_user_id ON feature_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_votes_feature_request_id ON feature_votes(feature_request_id);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_votes ENABLE ROW LEVEL SECURITY;

-- Bug Reports Policies
CREATE POLICY "Users can view their own bug reports" ON bug_reports
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bug reports" ON bug_reports
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bug reports" ON bug_reports
    FOR UPDATE USING (auth.uid() = user_id);

-- Allow admin users to view and update all bug reports (you'll need to implement admin role checking)
CREATE POLICY "Admins can view all bug reports" ON bug_reports
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

CREATE POLICY "Admins can update all bug reports" ON bug_reports
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Feature Requests Policies
CREATE POLICY "Users can view all feature requests" ON feature_requests
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own feature requests" ON feature_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feature requests" ON feature_requests
    FOR UPDATE USING (auth.uid() = user_id);

-- Allow admin users to update all feature requests
CREATE POLICY "Admins can update all feature requests" ON feature_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Feature Votes Policies
CREATE POLICY "Users can view all feature votes" ON feature_votes
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own feature votes" ON feature_votes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feature votes" ON feature_votes
    FOR DELETE USING (auth.uid() = user_id);

-- Functions for vote count management

-- Function to increment vote count
CREATE OR REPLACE FUNCTION increment_vote_count(request_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE feature_requests
    SET vote_count = vote_count + 1, updated_at = NOW()
    WHERE id = request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrement vote count
CREATE OR REPLACE FUNCTION decrement_vote_count(request_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE feature_requests
    SET vote_count = GREATEST(vote_count - 1, 0), updated_at = NOW()
    WHERE id = request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to all tables
CREATE TRIGGER update_bug_reports_updated_at
    BEFORE UPDATE ON bug_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feature_requests_updated_at
    BEFORE UPDATE ON feature_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample categories for reference (you might want to insert these as seed data)

-- Bug Report Categories:
-- 'Voice Recognition Issues'
-- 'Wrong or Bad Answers'
-- 'App Crashes or Freezes'
-- 'Audio Problems'
-- 'Vehicle Info Not Saving'
-- 'Login/Account Issues'
-- 'Performance Issues'
-- 'Other'

-- Feature Request Categories:
-- 'Voice Recognition Improvements'
-- 'New Vehicle/Engine Support'
-- 'Better Diagnostic Tools'
-- 'Tool Recommendations'
-- 'Parts Information'
-- 'Repair Procedures'
-- 'Video/Visual Guides'
-- 'Integration with Other Apps'
-- 'Offline Features'
-- 'User Interface Improvements'
-- 'Other'

-- Grant permissions for the service role to call functions
GRANT EXECUTE ON FUNCTION increment_vote_count(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION decrement_vote_count(UUID) TO service_role;

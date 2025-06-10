-- Add deactivation tracking fields to vehicles table
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deactivation_reason TEXT,
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ DEFAULT NOW();

-- Update existing vehicles to be active by default
UPDATE vehicles SET is_active = true WHERE is_active IS NULL;

-- Add similar fields to documents table for document deactivation
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vehicles_is_active ON vehicles(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_vehicles_deactivation_reason ON vehicles(deactivation_reason) WHERE deactivation_reason IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_deactivation_reason ON documents(deactivation_reason) WHERE deactivation_reason IS NOT NULL;

-- Create activity log table for tracking tier changes and downgrades
CREATE TABLE IF NOT EXISTS user_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create notifications table for in-app notifications
CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies (use DO block to handle existing policies)
ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies with conditional creation
DO $$
BEGIN
    -- Activity log policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_activity_log' AND policyname = 'Users can view their own activity log') THEN
        CREATE POLICY "Users can view their own activity log" ON user_activity_log
            FOR SELECT USING (auth.uid() = user_id);
    END IF;

    -- Notification policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_notifications' AND policyname = 'Users can view their own notifications') THEN
        CREATE POLICY "Users can view their own notifications" ON user_notifications
            FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_notifications' AND policyname = 'Users can update their own notifications') THEN
        CREATE POLICY "Users can update their own notifications" ON user_notifications
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;
END $$;

-- Add indexes for notifications
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_read_at ON user_notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_id ON user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_action ON user_activity_log(user_id, action);

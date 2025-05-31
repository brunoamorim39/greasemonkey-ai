-- Create documents table for storing document metadata
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE NULL, -- NULL for system documents
    title TEXT NOT NULL,
    filename TEXT NOT NULL,
    document_type TEXT NOT NULL CHECK (document_type IN ('user_upload', 'bentley_manual', 'haynes_manual', 'fsm_official', 'repair_guide')),
    car_make TEXT,
    car_model TEXT,
    car_year INTEGER,
    car_engine TEXT,
    file_size INTEGER NOT NULL,
    page_count INTEGER,
    storage_path TEXT, -- Path to file in Supabase Storage
    status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'error')),
    upload_date TIMESTAMPTZ DEFAULT NOW(),
    processed_date TIMESTAMPTZ,
    error_message TEXT,
    tags TEXT[] DEFAULT '{}',
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_car_make ON documents(car_make);
CREATE INDEX IF NOT EXISTS idx_documents_car_model ON documents(car_model);
CREATE INDEX IF NOT EXISTS idx_documents_car_year ON documents(car_year);
CREATE INDEX IF NOT EXISTS idx_documents_document_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_is_public ON documents(is_public);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING GIN(tags);

-- Create a composite index for car searches
CREATE INDEX IF NOT EXISTS idx_documents_car_info ON documents(car_make, car_model, car_year);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies for security
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Users can see their own documents and public system documents
CREATE POLICY "Users can view own documents and public system documents" ON documents
    FOR SELECT USING (
        user_id = auth.uid() OR
        (user_id IS NULL AND is_public = TRUE) OR
        is_public = TRUE
    );

-- Users can insert their own documents
CREATE POLICY "Users can insert own documents" ON documents
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own documents
CREATE POLICY "Users can update own documents" ON documents
    FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own documents
CREATE POLICY "Users can delete own documents" ON documents
    FOR DELETE USING (user_id = auth.uid());

-- System can insert system documents (NULL user_id)
CREATE POLICY "System can manage system documents" ON documents
    FOR ALL USING (user_id IS NULL);

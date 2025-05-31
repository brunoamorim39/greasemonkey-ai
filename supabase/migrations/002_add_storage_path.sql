-- Add storage_path column to documents table for cloud file storage
ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- Add index for storage_path for efficient queries
CREATE INDEX IF NOT EXISTS idx_documents_storage_path ON documents(storage_path);

-- Add comment to describe the column
COMMENT ON COLUMN documents.storage_path IS 'Path to the document file in Supabase Storage bucket';

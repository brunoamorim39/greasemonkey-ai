-- Migration: Add vehicle-document relationships and simplify categories
-- This handles the vehicle_id relationship and category simplification

-- Add vehicle_id column to documents table if it doesn't exist
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE;

-- Update the category constraint to simplified categories
ALTER TABLE documents
DROP CONSTRAINT IF EXISTS documents_category_check;

ALTER TABLE documents
ADD CONSTRAINT documents_category_check
CHECK (category IN (
  'service_manual',
  'owners_manual',
  'maintenance_record',
  'other'
));

-- Update existing category values to match new simplified structure
UPDATE documents SET category = 'other'
WHERE category IN ('parts_diagram', 'photo', 'video');

UPDATE documents SET category = 'owners_manual'
WHERE category = 'owner_manual';

-- Add index for vehicle_id lookups
CREATE INDEX IF NOT EXISTS idx_documents_vehicle_id ON documents(vehicle_id);

-- Create function to handle vehicle deletion with document cleanup
CREATE OR REPLACE FUNCTION delete_vehicle_documents()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete all documents associated with the vehicle
  DELETE FROM documents WHERE vehicle_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically delete documents when vehicle is deleted
DROP TRIGGER IF EXISTS trigger_delete_vehicle_documents ON vehicles;
CREATE TRIGGER trigger_delete_vehicle_documents
  BEFORE DELETE ON vehicles
  FOR EACH ROW
  EXECUTE FUNCTION delete_vehicle_documents();

-- Add comment for documentation
COMMENT ON COLUMN documents.vehicle_id IS 'Associates document with specific vehicle in user garage';
COMMENT ON TRIGGER trigger_delete_vehicle_documents ON vehicles IS 'Automatically deletes associated documents when vehicle is deleted';

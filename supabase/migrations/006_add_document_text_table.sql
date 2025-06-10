-- Add document_text table for storing extracted text from uploaded documents
-- This enables semantic search and GPT context integration

CREATE TABLE IF NOT EXISTS public.document_text (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  extracted_text text NOT NULL,
  text_length integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT document_text_document_id_unique UNIQUE (document_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_document_text_document_id ON public.document_text(document_id);
CREATE INDEX IF NOT EXISTS idx_document_text_search ON public.document_text USING gin(to_tsvector('english', extracted_text));

-- Enable RLS
ALTER TABLE public.document_text ENABLE ROW LEVEL SECURITY;

-- RLS policies - users can only access text from their own documents
DROP POLICY IF EXISTS "Users can access text from own documents" ON public.document_text;
CREATE POLICY "Users can access text from own documents" ON public.document_text
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.documents
      WHERE documents.id = document_text.document_id
      AND documents.user_id = auth.uid()
    )
  );

-- Add updated_at trigger
DROP TRIGGER IF EXISTS update_document_text_updated_at ON public.document_text;
CREATE TRIGGER update_document_text_updated_at
  BEFORE UPDATE ON public.document_text
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE public.document_text IS 'Extracted text content from uploaded documents for AI search and context';
COMMENT ON COLUMN public.document_text.extracted_text IS 'Full text content extracted from the document';
COMMENT ON COLUMN public.document_text.text_length IS 'Character count of extracted text for analytics';

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { documentService } from '@/lib/services/document-service'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase/types'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

async function debugDocumentsHandler(request: NextRequest & { userId: string }) {
  try {
    const userId = request.userId

    // Get all user documents with their text processing status
    const { data: documents, error } = await supabase
      .from('documents')
      .select(`
        *,
        document_text (
          extracted_text,
          text_length
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching documents:', error)
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
    }

    // Format the response with processing status
    const documentStatus = documents?.map(doc => ({
      id: doc.id,
      filename: doc.original_filename,
      status: doc.status,
      file_type: doc.file_type,
      file_size_mb: (doc.file_size / (1024 * 1024)).toFixed(2),
      created_at: doc.created_at,
      hasExtractedText: !!doc.document_text?.[0]?.extracted_text,
      textLength: doc.document_text?.[0]?.text_length || 0,
      textPreview: doc.document_text?.[0]?.extracted_text?.substring(0, 200) + '...' || 'No text extracted',
      storage_path: doc.storage_path
    })) || []

    // Test document search
    const testQuery = 'oil capacity'
    console.log(`🧪 Testing document search with query: "${testQuery}"`)

    const searchResults = await documentService.searchDocuments(userId, {
      query: testQuery,
      limit: 5
    })

    return NextResponse.json({
      userId,
      totalDocuments: documentStatus.length,
      documents: documentStatus,
      testSearch: {
        query: testQuery,
        resultsCount: searchResults.length,
        results: searchResults.map(r => ({
          filename: r.document.original_filename,
          relevanceScore: r.relevanceScore,
          contentLength: r.content.length,
          contentPreview: r.content.substring(0, 300) + '...'
        }))
      },
      processing: {
        uploaded: documentStatus.filter(d => d.status === 'uploaded').length,
        processing: documentStatus.filter(d => d.status === 'processing').length,
        processed: documentStatus.filter(d => d.status === 'processed').length,
        failed: documentStatus.filter(d => d.status === 'failed').length,
        withText: documentStatus.filter(d => d.hasExtractedText).length
      }
    })

  } catch (error) {
    console.error('Error in debug documents handler:', error)
    return NextResponse.json(
      { error: 'Failed to debug documents' },
      { status: 500 }
    )
  }
}

// Temporarily remove auth for debugging
export async function GET(request: NextRequest) {
  // Mock user ID for debugging - replace with actual user ID if needed
  const mockRequest = request as NextRequest & { userId: string }
  mockRequest.userId = 'c15aebf7-92d6-48ad-9399-7f94ce6e1b54' // Your actual user ID from logs
  return debugDocumentsHandler(mockRequest)
}

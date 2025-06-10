import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
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

async function debugDocumentsFullHandler(request: NextRequest & { userId: string }) {
  try {
    const userId = request.userId

    console.log(`🔍 Full document debug for user: ${userId}`)

    // Get all user documents with their text processing status
    const { data: documents, error } = await supabase
      .from('documents')
      .select(`
        *,
        document_text (
          extracted_text,
          text_length,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching documents:', error)
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
    }

    console.log(`📄 Found ${documents?.length || 0} documents`)

    // Enhanced document analysis
    const documentStatus = documents?.map(doc => {
      const textRecord = doc.document_text?.[0]
      const hasExtractedText = !!textRecord?.extracted_text
      const textLength = textRecord?.text_length || 0

      return {
        id: doc.id,
        filename: doc.original_filename,
        status: doc.status,
        category: doc.category,
        file_size_mb: (doc.file_size / (1024 * 1024)).toFixed(2),
        created_at: doc.created_at,
        updated_at: doc.updated_at,

        // Text processing details
        hasExtractedText,
        textLength,
        textRecord: textRecord ? {
          created_at: textRecord.created_at,
          updated_at: textRecord.updated_at,
          text_preview: textRecord.extracted_text?.substring(0, 500) || 'No text'
        } : null,

        // File location
        storage_path: doc.storage_path,

        // Processing metadata
        document_type: doc.document_type,
        car_make: doc.car_make,
        car_model: doc.car_model,
        car_year: doc.car_year,
        vehicle_id: doc.vehicle_id
      }
    }) || []

    // Check storage bucket status for a few documents
    const storageChecks = await Promise.all(
      documentStatus.slice(0, 3).map(async (doc) => {
        try {
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('documents')
            .download(doc.storage_path!)

          return {
            document_id: doc.id,
            filename: doc.filename,
            storage_exists: !downloadError,
            file_size_bytes: fileData ? (await fileData.arrayBuffer()).byteLength : 0,
            error: downloadError?.message
          }
        } catch (error) {
          return {
            document_id: doc.id,
            filename: doc.filename,
            storage_exists: false,
            file_size_bytes: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      })
    )

    // Processing status summary
    const processingStats = {
      total: documentStatus.length,
      by_status: {
        uploaded: documentStatus.filter(d => d.status === 'uploaded').length,
        processing: documentStatus.filter(d => d.status === 'processing').length,
        processed: documentStatus.filter(d => d.status === 'processed').length,
        failed: documentStatus.filter(d => d.status === 'failed').length
      },
      text_extraction: {
        has_text: documentStatus.filter(d => d.hasExtractedText).length,
        no_text: documentStatus.filter(d => !d.hasExtractedText).length,
        total_text_length: documentStatus.reduce((sum, d) => sum + d.textLength, 0)
      },
      categories: documentStatus.reduce((acc, doc) => {
        acc[doc.category] = (acc[doc.category] || 0) + 1
        return acc
      }, {} as Record<string, number>)
    }

    console.log('📊 Processing stats:', processingStats)

    return NextResponse.json({
      userId,
      documents: documentStatus,
      storageChecks,
      processingStats,
      debug_info: {
        timestamp: new Date().toISOString(),
        total_documents: documentStatus.length,
        documents_with_searchable_text: documentStatus.filter(d => d.hasExtractedText && d.textLength > 0).length
      }
    })

  } catch (error) {
    console.error('Error in full debug documents handler:', error)
    return NextResponse.json(
      { error: 'Failed to debug documents', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export const GET = withAuth(debugDocumentsFullHandler)

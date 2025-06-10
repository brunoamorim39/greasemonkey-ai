import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase/types'
// @ts-ignore - pdf-parse types not available
const pdf = require('pdf-parse')

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { documentId } = body

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID required' }, { status: 400 })
    }

    console.log(`🔄 Reprocessing document: ${documentId}`)

    // Get the document details
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (docError || !document) {
      console.error('Document not found:', docError)
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    console.log('📄 Document found:', {
      id: document.id,
      filename: document.original_filename,
      status: document.status,
      storage_path: document.storage_path,
      file_type: document.file_type,
      allFields: Object.keys(document)
    })

    // Process the document directly (bypass auth for debugging)
    console.log('🔧 Starting PDF text extraction...')

    // Download file from storage
    console.log('📥 Downloading file from storage...')
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.storage_path)

    if (downloadError || !fileData) {
      console.error('Download error:', downloadError)
      return NextResponse.json({ error: 'Failed to download document' }, { status: 500 })
    }

    console.log('📄 File downloaded, extracting text...')
    let extractedText = ''

    try {
      // Determine file type (fallback to filename if file_type is missing)
      const fileType = document.file_type || getFileTypeFromFilename(document.original_filename)
      console.log('🔍 Determined file type:', fileType)

      // Extract text based on file type
      if (fileType === 'application/pdf' || document.original_filename.toLowerCase().endsWith('.pdf')) {
        console.log('🔍 Processing PDF with pdfjs-dist...')
        extractedText = await extractTextFromPDF(fileData)
      } else if (fileType === 'text/plain' || document.original_filename.toLowerCase().endsWith('.txt')) {
        console.log('📝 Processing plain text file...')
        extractedText = await fileData.text()
      } else {
        console.log('❌ Unsupported file type:', fileType, 'for filename:', document.original_filename)
        return NextResponse.json({ error: 'Unsupported file type for processing' }, { status: 400 })
      }
    } catch (extractionError) {
      console.error('💥 Text extraction failed:', extractionError)
      return NextResponse.json({
        error: 'Text extraction failed',
        details: extractionError instanceof Error ? extractionError.message : 'Unknown error'
      }, { status: 400 })
    }

    console.log('📝 Text extracted:', {
      length: extractedText.length,
      preview: extractedText.substring(0, 200) + '...'
    })

    if (extractedText.trim()) {
      // Store extracted text in database
      console.log('💾 Storing extracted text in database...')
      const { error: insertError } = await supabase
        .from('document_text')
        .upsert({
          document_id: document.id,
          extracted_text: extractedText,
          text_length: extractedText.length,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'document_id'
        })

      if (insertError) {
        console.error('Error storing text:', insertError)
        return NextResponse.json({ error: 'Failed to store extracted text' }, { status: 500 })
      }

      // Update document status
      await supabase
        .from('documents')
        .update({
          status: 'processed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', document.id)

      console.log('✅ Text extraction and storage completed!')
    } else {
      console.log('❌ No text could be extracted from document')
      return NextResponse.json({ error: 'No text could be extracted from document' }, { status: 400 })
    }

    // Check the updated document
    const { data: updatedDoc, error: updateError } = await supabase
      .from('documents')
      .select(`
        *,
        document_text (
          extracted_text,
          text_length
        )
      `)
      .eq('id', documentId)
      .single()

    if (updateError) {
      console.error('Error fetching updated document:', updateError)
      return NextResponse.json({ error: 'Failed to fetch updated document' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Document reprocessed successfully',
      document: {
        id: updatedDoc?.id,
        filename: updatedDoc?.original_filename,
        status: updatedDoc?.status,
        hasExtractedText: !!updatedDoc?.document_text?.[0]?.extracted_text,
        textLength: updatedDoc?.document_text?.[0]?.text_length || 0,
        textPreview: updatedDoc?.document_text?.[0]?.extracted_text?.substring(0, 300) + '...' || 'No text'
      }
    })

  } catch (error) {
    console.error('Error reprocessing document:', error)
    return NextResponse.json(
      { error: 'Failed to reprocess document' },
      { status: 500 }
    )
  }
}

function getFileTypeFromFilename(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop()
  switch (ext) {
    case 'pdf':
      return 'application/pdf'
    case 'txt':
      return 'text/plain'
    case 'doc':
      return 'application/msword'
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    default:
      return 'unknown'
  }
}

async function extractTextFromPDF(file: Blob): Promise<string> {
  try {
    console.log('📦 Converting blob to buffer...')
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    console.log('📦 Buffer size:', buffer.length)

    console.log('📖 Extracting text with pdf-parse...')
    const data = await pdf(buffer)

    console.log('📄 PDF processed successfully')
    console.log('📑 Pages:', data.numpages)
    console.log('📝 Text length:', data.text.length)
    console.log('📄 Info:', data.info)

    if (!data.text || data.text.trim().length === 0) {
      throw new Error('No text found in PDF')
    }

    return data.text.trim()
  } catch (error) {
    console.error('💥 PDF extraction error:', error)
    throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

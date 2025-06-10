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

async function forceReprocessHandler(request: NextRequest & { userId: string }) {
  try {
    const userId = request.userId

    console.log(`🔄 Force reprocessing all documents for user: ${userId}`)

    // Get all user documents that need processing
    const { data: documents, error } = await supabase
      .from('documents')
      .select('id, original_filename, status, storage_path, category')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching documents:', error)
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
    }

    console.log(`📄 Found ${documents?.length || 0} documents to potentially reprocess`)

    const results = []

    for (const doc of documents || []) {
      console.log(`🔧 Processing document: ${doc.original_filename}`)

      try {
        // Mark as processing
        await supabase
          .from('documents')
          .update({ status: 'processing', updated_at: new Date().toISOString() })
          .eq('id', doc.id)

        // Process the document
        const result = await processDocument(doc)
        results.push(result)

        console.log(`✅ Processed ${doc.original_filename}: ${result.success ? 'SUCCESS' : 'FAILED'}`)

      } catch (error) {
        console.error(`❌ Failed to process ${doc.original_filename}:`, error)

        // Mark as failed
        await supabase
          .from('documents')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', doc.id)

        results.push({
          document_id: doc.id,
          filename: doc.original_filename,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    console.log(`📊 Reprocessing complete: ${successCount} successful, ${failCount} failed`)

    return NextResponse.json({
      message: 'Force reprocessing completed',
      total_documents: results.length,
      successful: successCount,
      failed: failCount,
      results
    })

  } catch (error) {
    console.error('Error in force reprocess handler:', error)
    return NextResponse.json(
      { error: 'Failed to force reprocess documents' },
      { status: 500 }
    )
  }
}

async function processDocument(document: any) {
  console.log(`📥 Downloading file: ${document.storage_path}`)

  // Download file from storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('documents')
    .download(document.storage_path)

  if (downloadError || !fileData) {
    throw new Error(`Download failed: ${downloadError?.message}`)
  }

  console.log(`📄 File downloaded, size: ${(await fileData.arrayBuffer()).byteLength} bytes`)

  let extractedText = ''

  // Extract text based on file extension (since file_type column doesn't exist in schema)
  const filename = document.original_filename.toLowerCase()
  if (filename.endsWith('.pdf')) {
    console.log('🔍 Processing as PDF...')
    extractedText = await extractTextFromPDF(fileData)
  } else if (filename.endsWith('.txt')) {
    console.log('📝 Processing as text file...')
    extractedText = await fileData.text()
  } else {
    throw new Error(`Unsupported file type for file: ${document.original_filename}`)
  }

  console.log(`📝 Extracted text length: ${extractedText.length}`)

  if (extractedText.trim()) {
    // Store extracted text in database
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
      throw new Error(`Failed to store text: ${insertError.message}`)
    }

    // Update document status
    await supabase
      .from('documents')
      .update({
        status: 'processed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', document.id)

    return {
      document_id: document.id,
      filename: document.original_filename,
      success: true,
      text_length: extractedText.length,
      text_preview: extractedText.substring(0, 200)
    }
  } else {
    // Mark as failed if no text extracted
    await supabase
      .from('documents')
      .update({
        status: 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', document.id)

    throw new Error('No text could be extracted from document')
  }
}

async function extractTextFromPDF(file: Blob): Promise<string> {
  try {
    // Try using pdf-parse for better text extraction
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Dynamic import for pdf-parse
    const pdfParse = require('pdf-parse')
    const data = await pdfParse(buffer)

    if (!data.text || data.text.trim().length === 0) {
      throw new Error('No text found in PDF')
    }

    console.log(`📄 PDF processed: ${data.numpages} pages, ${data.text.length} characters`)
    return data.text.trim()

  } catch (error) {
    console.error('PDF extraction error:', error)
    throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export const POST = withAuth(forceReprocessHandler)

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase/types'
// PDF.js can only be imported server-side
// @ts-ignore - PDF.js types not available but works fine
import * as pdfjsLib from 'pdfjs-dist'

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

async function processDocumentHandler(request: NextRequest & { userId: string }) {
  try {
    const { documentId } = await request.json()

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 })
    }

    // Get document info
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('user_id', request.userId)
      .single()

    if (docError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.storage_path)

    if (downloadError || !fileData) {
      return NextResponse.json({ error: 'Failed to download document' }, { status: 500 })
    }

    let extractedText = ''

    // Extract text based on file type
    if (document.file_type === 'application/pdf') {
      extractedText = await extractTextFromPDF(fileData)
    } else if (document.file_type === 'text/plain') {
      extractedText = await fileData.text()
    } else {
      return NextResponse.json({ error: 'Unsupported file type for processing' }, { status: 400 })
    }

    if (extractedText.trim()) {
      // Store extracted text in database
      await supabase
        .from('document_text')
        .upsert({
          document_id: documentId,
          extracted_text: extractedText,
          text_length: extractedText.length,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'document_id'
        })

      // Update document status
      await supabase
        .from('documents')
        .update({
          status: 'processed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId)

      return NextResponse.json({
        success: true,
        textLength: extractedText.length,
        documentId
      })
    } else {
      // Mark as failed if no text extracted
      await supabase
        .from('documents')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId)

      return NextResponse.json({ error: 'No text could be extracted from document' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error processing document:', error)

    return NextResponse.json(
      { error: 'Failed to process document' },
      { status: 500 }
    )
  }
}

async function extractTextFromPDF(file: Blob): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

    let fullText = ''

    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()

      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')

      fullText += pageText + '\n\n'
    }

    return fullText.trim()
  } catch (error) {
    console.error('Error extracting PDF text:', error)
    throw error
  }
}

export const POST = withAuth(processDocumentHandler)

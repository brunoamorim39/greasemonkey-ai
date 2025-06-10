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

async function checkTextHandler(request: NextRequest & { userId: string }) {
  try {
    const userId = request.userId

    // Check documents table
    const { data: documents, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', userId)

    if (docError) {
      return NextResponse.json({ error: 'Failed to fetch documents', details: docError }, { status: 500 })
    }

    // Check document_text table directly
    const { data: documentTexts, error: textError } = await supabase
      .from('document_text')
      .select('*')

    if (textError) {
      return NextResponse.json({ error: 'Failed to fetch document_text', details: textError }, { status: 500 })
    }

    // Check the join query that's failing
    const { data: joinQuery, error: joinError } = await supabase
      .from('documents')
      .select(`
        *,
        document_text (
          extracted_text,
          text_length
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'processed')

    return NextResponse.json({
      userId,
      documents: documents?.map(d => ({
        id: d.id,
        filename: d.original_filename,
        status: d.status,
        created_at: d.created_at
      })),
      documentTexts: documentTexts?.map(dt => ({
        id: dt.id,
        document_id: dt.document_id,
        text_length: dt.text_length,
        text_preview: dt.extracted_text?.substring(0, 100) || 'No text'
      })),
      joinQuery: joinQuery?.map(jq => ({
        id: jq.id,
        filename: jq.original_filename,
        status: jq.status,
        hasTextRecord: !!jq.document_text?.[0],
        textLength: jq.document_text?.[0]?.text_length || 0
      })),
      joinError: joinError
    })

  } catch (error) {
    console.error('Error in check text handler:', error)
    return NextResponse.json(
      { error: 'Failed to check text', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export const GET = withAuth(checkTextHandler)

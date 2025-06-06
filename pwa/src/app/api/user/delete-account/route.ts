import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { documentService } from '@/lib/services/document-service'
import { withAuth } from '@/lib/auth'

async function deleteAccountHandler(request: NextRequest & { userId: string }) {
  try {
    const userId = request.userId

    // This is a permanent action - verify with request body
    const body = await request.json()
    const { confirmationText } = body

    if (confirmationText !== 'DELETE MY ACCOUNT') {
      return NextResponse.json(
        { error: 'Account deletion requires proper confirmation' },
        { status: 400 }
      )
    }

    // Start transaction-like cleanup
    const errors: string[] = []

    // 1. Delete uploaded documents and their files
    try {
      const documents = await documentService.getUserDocuments(userId)
      for (const doc of documents) {
        await documentService.deleteDocument(userId, doc.id)
      }
    } catch (error) {
      console.error('Error deleting user documents:', error)
      errors.push('Failed to delete some documents')
    }

    // 2. Delete from all user-related tables
    const tablesToClear = [
      'query_logs',
      'usage_records',
      'daily_usage_stats',
      'subscriptions',
      'user_tiers',
      'vehicles',
      'documents', // In case document service missed any
      'user_preferences',
    ]

    for (const table of tablesToClear) {
      try {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq('user_id', userId)

        if (error) {
          console.error(`Error deleting from ${table}:`, error)
          errors.push(`Failed to clear ${table}`)
        }
      } catch (error) {
        console.error(`Error deleting from ${table}:`, error)
        errors.push(`Failed to clear ${table}`)
      }
    }

    // 3. Note: We don't delete from auth.users as that's handled by Supabase Auth
    // The user will need to be directed to delete their account through auth

    if (errors.length > 0) {
      return NextResponse.json(
        {
          error: 'Partial deletion completed with errors',
          details: errors,
          warning: 'Some data may still exist. Contact support if needed.'
        },
        { status: 207 } // Multi-status
      )
    }

    return NextResponse.json({
      message: 'Account data deleted successfully',
      note: 'Your authentication account still exists. Please delete it through your account settings or contact support.',
      deleted_data: tablesToClear
    })
  } catch (error) {
    console.error('Error deleting account:', error)
    return NextResponse.json(
      { error: 'Failed to delete account data' },
      { status: 500 }
    )
  }
}

export const POST = withAuth(deleteAccountHandler)

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { withAuth } from '@/lib/auth'

async function clearHistoryHandler(request: NextRequest & { userId: string }) {
  try {
    const userId = request.userId
    console.log('Clear history request for user:', userId)

    let totalCleared = 0
    const errors: string[] = []

    // Try clearing from multiple possible tables (since schema has evolved)
    const tablesToClear = ['conversations', 'queries', 'query_logs']

    for (const tableName of tablesToClear) {
      try {
        const { error, count } = await supabase
          .from(tableName)
          .delete()
          .eq('user_id', userId)

        if (error) {
          // If table doesn't exist, skip it silently
          if (error.code === '42P01') {
            console.log(`Table ${tableName} does not exist, skipping`)
            continue
          }
          console.error(`Error clearing ${tableName}:`, error)
          errors.push(`${tableName}: ${error.message}`)
        } else {
          const cleared = count || 0
          if (cleared > 0) {
            console.log(`Cleared ${cleared} records from ${tableName} for user ${userId}`)
            totalCleared += cleared
          }
        }
      } catch (tableError) {
        console.error(`Error accessing table ${tableName}:`, tableError)
        errors.push(`${tableName}: ${tableError}`)
      }
    }

    if (errors.length > 0) {
      console.error('Some errors occurred while clearing history:', errors)
    }

    return NextResponse.json({
      message: 'Conversation history cleared successfully',
      cleared_count: totalCleared,
      tables_checked: tablesToClear,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error('Error clearing history:', error)
    return NextResponse.json(
      { error: 'Failed to clear conversation history' },
      { status: 500 }
    )
  }
}

export const POST = withAuth(clearHistoryHandler)

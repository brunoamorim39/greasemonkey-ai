import { NextRequest, NextResponse } from 'next/server'
import { userService } from '@/lib/services/user-service'
import { vehicleService } from '@/lib/services/vehicle-service'
import { documentService } from '@/lib/services/document-service'
import { supabase } from '@/lib/supabase'
import { withAuth } from '@/lib/auth'

async function exportUserDataHandler(request: NextRequest & { userId: string }) {
  try {
    const userId = request.userId

    // Get all user data in parallel
    const [
      preferences,
      tier,
      usageStats,
      vehicles,
      documents,
      queryHistory,
    ] = await Promise.all([
      userService.getUserPreferences(userId),
      userService.getUserTier(userId),
      userService.getUsageStats(userId),
      vehicleService.getUserVehicles(userId),
      documentService.getUserDocuments(userId),
      getQueryHistory(userId),
    ])

    // Compile comprehensive export data
    const exportData = {
      user_id: userId,
      export_date: new Date().toISOString(),
      export_version: '1.0',

      // User settings and preferences
      preferences,

      // Account information
      account: {
        tier,
        created_at: null, // TODO: Add user creation date if available
      },

      // Usage statistics
      usage: usageStats,

      // Vehicles data
      vehicles: vehicles.map(v => ({
        id: v.id,
        make: v.make,
        model: v.model,
        year: v.year,
        trim: v.trim,
        engine: v.engine,
        nickname: v.nickname,
        notes: v.notes,
        mileage: v.mileage,
        created_at: v.created_at,
        updated_at: v.updated_at,
      })),

      // Documents data (metadata only, not file contents)
      documents: documents.map(d => ({
        id: d.id,
        filename: d.filename,
        original_filename: d.original_filename,
        document_type: d.document_type,
        status: d.status,
        file_size: d.file_size,
        file_type: d.file_type,
        car_make: d.car_make,
        car_model: d.car_model,
        car_year: d.car_year,
        storage_path: d.storage_path,
        metadata: d.metadata,
        created_at: d.created_at,
        updated_at: d.updated_at,
      })),

      // Query/conversation history
      query_history: queryHistory,

      // Export metadata
      export_info: {
        total_vehicles: vehicles.length,
        total_documents: documents.length,
        total_queries: queryHistory.length,
        storage_used_mb: documents.reduce((sum, doc) => sum + doc.file_size, 0) / (1024 * 1024),
      }
    }

    return NextResponse.json(exportData)
  } catch (error) {
    console.error('Error exporting user data:', error)
    return NextResponse.json(
      { error: 'Failed to export user data' },
      { status: 500 }
    )
  }
}

async function getQueryHistory(userId: string) {
  try {
    const { data, error } = await supabase
      .from('query_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1000) // Limit to last 1000 queries for performance

    if (error) {
      console.error('Error fetching query history:', error)
      return []
    }

    return data?.map(query => ({
      id: query.id,
      question: query.question,
      response: query.response,
      car_make: query.car_make,
      car_model: query.car_model,
      car_year: query.car_year,
      car_engine: query.car_engine,
      created_at: query.created_at,
    })) || []
  } catch (error) {
    console.error('Error in getQueryHistory:', error)
    return []
  }
}

export const GET = withAuth(exportUserDataHandler)

import { NextRequest, NextResponse } from 'next/server'
import { userService } from '@/lib/services/user-service'
import { vehicleService } from '@/lib/services/vehicle-service'
import { documentService } from '@/lib/services/document-service'
import { config } from '@/lib/config'
import { withAuth } from '@/lib/auth'

async function getUserStatsHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || config.app.defaultUserId

    // Get all user data in parallel
    const [
      tier,
      usageStats,
      vehicles,
      documents,
      storageUsage,
    ] = await Promise.all([
      userService.getUserTier(userId),
      userService.getUsageStats(userId),
      vehicleService.getUserVehicles(userId),
      documentService.getUserDocuments(userId),
      documentService.getUserStorageUsage(userId),
    ])

    const response = {
      tier,
      usage: usageStats,
      vehicles: {
        count: vehicles.length,
        vehicles: vehicles.map(v => ({
          id: v.id,
          displayName: vehicleService.formatVehicleString(v),
          make: v.make,
          model: v.model,
          year: v.year,
        })),
      },
      documents: {
        count: documents.length,
        storageUsedMB: storageUsage,
        documents: documents.map(d => ({
          id: d.id,
          filename: d.original_filename,
          type: d.document_type,
          status: d.status,
          sizeMB: (d.file_size / (1024 * 1024)).toFixed(2),
          createdAt: d.created_at,
        })),
      },
      limits: usageStats.limits,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching user stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user statistics' },
      { status: 500 }
    )
  }
}

export const GET = withAuth(getUserStatsHandler)

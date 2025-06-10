import { NextRequest, NextResponse } from 'next/server'
import { userService } from '@/lib/services/user-service'
import { vehicleService } from '@/lib/services/vehicle-service'
import { documentService } from '@/lib/services/document-service'
import { downgradeService } from '@/lib/services/downgrade-service'
import { config, TIER_LIMITS, UserTier } from '@/lib/config'
import { withAuth } from '@/lib/auth'

async function getUserStatsHandler(request: NextRequest & { userId: string }) {
  try {
    // Get authenticated user ID from middleware
    const userId = request.userId

    // Get user tier first
    const tierString = await userService.getUserTier(userId)
    const tier = tierString as UserTier // Cast string to enum
    const tierLimits = TIER_LIMITS[tier]

    // Get all vehicles (active and inactive) to check current state
    const allVehicles = await vehicleService.getUserVehicles(userId, true) // Include inactive
    let activeVehicles = allVehicles.filter(v => v.is_active !== false)
    const inactiveVehicles = allVehicles.filter(v => v.is_active === false && v.deactivation_reason === 'tier_downgrade')

    // Check if user has capacity to reactivate vehicles (UPGRADE LOGIC)
    if (inactiveVehicles.length > 0) {
      const maxAllowed = tierLimits.maxVehicles
      const currentActive = activeVehicles.length

      if (maxAllowed === null || currentActive < maxAllowed) {
        console.log(`User has capacity for more vehicles. Active: ${currentActive}, Max: ${maxAllowed}, Inactive: ${inactiveVehicles.length}. Auto-reactivating...`)

        // Automatically restore access - this will reactivate vehicles up to the limit
        await downgradeService.restoreAccess(userId, tier)

        // Reload vehicles after potential reactivation to get updated state
        const updatedAllVehicles = await vehicleService.getUserVehicles(userId, true)
        activeVehicles = updatedAllVehicles.filter(v => v.is_active !== false)
      }
    }

    // Check if user has more vehicles than allowed and apply restrictions if needed (DOWNGRADE LOGIC)
    if (tierLimits.maxVehicles !== null && activeVehicles.length > tierLimits.maxVehicles) {
      console.log(`User has ${activeVehicles.length} active vehicles but tier ${tier} only allows ${tierLimits.maxVehicles}. Applying restrictions...`)

      // Apply downgrade restrictions
      await downgradeService.executeDowngrade(userId, tier, { notifyUser: false })

      // Reload vehicles after potential deactivation to get updated state
      const updatedAllVehicles = await vehicleService.getUserVehicles(userId, true)
      activeVehicles = updatedAllVehicles.filter(v => v.is_active !== false)
    }

    // Get all user data in parallel (excluding vehicles since we already have them)
    const [
      usageStats,
      userProfile,
      documents,
      storageUsage,
    ] = await Promise.all([
      userService.getUsageStats(userId),
      userService.getUserProfile(userId),
      documentService.getUserDocuments(userId),
      documentService.getUserStorageUsage(userId),
    ])

    const response = {
      tier: tierString, // Return original string
      usage: usageStats,
      full_name: userProfile?.full_name,
      vehicles: {
        count: activeVehicles.length,
        vehicles: activeVehicles.map(v => ({
          id: v.id,
          displayName: vehicleService.formatVehicleString(v),
          make: v.make,
          model: v.model,
          year: v.year,
          trim: v.trim,
          engine: v.engine,
          nickname: v.nickname,
          notes: v.notes,
          mileage: v.mileage,
        })),
      },
      documents: {
        count: documents.length,
        storageUsedMB: storageUsage,
        documents: documents.map((d: any) => {
          return {
            id: d.id,
            filename: d.original_filename,
            type: d.category,
            category: d.category,
            status: d.status,
            sizeMB: d.file_size_bytes ? (d.file_size_bytes / (1024 * 1024)).toFixed(2) : '0.00',
            createdAt: d.created_at,
            vehicleId: d.vehicle_id,
            description: d.description,
          }
        }),
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

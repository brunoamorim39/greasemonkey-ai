import { NextRequest, NextResponse } from 'next/server'
import { vehicleService } from '@/lib/services/vehicle-service'
import { config } from '@/lib/config'
import { withAuth } from '@/lib/auth'

async function getVehicleHandler(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || config.app.defaultUserId

    const vehicle = await vehicleService.getVehicle(userId, params.id)

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ vehicle })
  } catch (error) {
    console.error('Error fetching vehicle:', error)
    return NextResponse.json(
      { error: 'Failed to fetch vehicle' },
      { status: 500 }
    )
  }
}

async function updateVehicleHandler(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { userId = config.app.defaultUserId, ...vehicleData } = body

    // Validate year if provided
    if (vehicleData.year) {
      const currentYear = new Date().getFullYear()
      if (vehicleData.year < 1900 || vehicleData.year > currentYear + 2) {
        return NextResponse.json(
          { error: 'Invalid year' },
          { status: 400 }
        )
      }
    }

    // Validate VIN if provided
    if (vehicleData.vin && !vehicleService.validateVIN(vehicleData.vin)) {
      return NextResponse.json(
        { error: 'Invalid VIN format' },
        { status: 400 }
      )
    }

    const vehicle = await vehicleService.updateVehicle(userId, params.id, vehicleData)

    if (!vehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ vehicle })
  } catch (error) {
    console.error('Error updating vehicle:', error)
    return NextResponse.json(
      { error: 'Failed to update vehicle' },
      { status: 500 }
    )
  }
}

async function deleteVehicleHandler(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || config.app.defaultUserId

    const success = await vehicleService.deleteVehicle(userId, params.id)

    if (!success) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ message: 'Vehicle deleted successfully' })
  } catch (error) {
    console.error('Error deleting vehicle:', error)
    return NextResponse.json(
      { error: 'Failed to delete vehicle' },
      { status: 500 }
    )
  }
}

export const GET = withAuth(getVehicleHandler)
export const PUT = withAuth(updateVehicleHandler)
export const DELETE = withAuth(deleteVehicleHandler)

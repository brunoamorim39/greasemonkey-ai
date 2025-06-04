import { NextRequest, NextResponse } from 'next/server'
import { vehicleService } from '@/lib/services/vehicle-service'
import { config } from '@/lib/config'
import { withAuth } from '@/lib/auth'

async function getVehiclesHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || config.app.defaultUserId

    const vehicles = await vehicleService.getUserVehicles(userId)

    return NextResponse.json({ vehicles })
  } catch (error) {
    console.error('Error fetching vehicles:', error)
    return NextResponse.json(
      { error: 'Failed to fetch vehicles' },
      { status: 500 }
    )
  }
}

async function createVehicleHandler(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId = config.app.defaultUserId, displayName, ...vehicleData } = body

    // Validate required fields
    if (!vehicleData.make || !vehicleData.model || !vehicleData.year) {
      return NextResponse.json(
        { error: 'Make, model, and year are required' },
        { status: 400 }
      )
    }

    // Validate year
    const currentYear = new Date().getFullYear()
    if (vehicleData.year < 1900 || vehicleData.year > currentYear + 2) {
      return NextResponse.json(
        { error: 'Invalid year' },
        { status: 400 }
      )
    }

    // Validate VIN if provided
    if (vehicleData.vin && !vehicleService.validateVIN(vehicleData.vin)) {
      return NextResponse.json(
        { error: 'Invalid VIN format' },
        { status: 400 }
      )
    }

    const vehicle = await vehicleService.createVehicle(userId, vehicleData)

    return NextResponse.json({ vehicle }, { status: 201 })
  } catch (error) {
    console.error('Error creating vehicle:', error)

    if (error instanceof Error && error.message.includes('Vehicle limit reached')) {
      return NextResponse.json(
        { error: error.message, upgrade_required: true },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create vehicle' },
      { status: 500 }
    )
  }
}

export const GET = withAuth(getVehiclesHandler)
export const POST = withAuth(createVehicleHandler)

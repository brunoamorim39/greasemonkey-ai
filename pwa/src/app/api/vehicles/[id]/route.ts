import { NextRequest, NextResponse } from 'next/server'
import { vehicleService } from '@/lib/services/vehicle-service'
import { config } from '@/lib/config'
import { validateApiKey } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Handle authentication
  const authResult = validateApiKey(request)
  if (!authResult.isValid) {
    return NextResponse.json(
      { error: authResult.error },
      { status: 401 }
    )
  }

  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || config.app.defaultUserId

    const vehicle = await vehicleService.getVehicle(userId, id)

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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Handle authentication
  const authResult = validateApiKey(request)
  if (!authResult.isValid) {
    return NextResponse.json(
      { error: authResult.error },
      { status: 401 }
    )
  }

  try {
    const { id } = await params
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

    const vehicle = await vehicleService.updateVehicle(userId, id, vehicleData)

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Handle authentication
  const authResult = validateApiKey(request)
  if (!authResult.isValid) {
    return NextResponse.json(
      { error: authResult.error },
      { status: 401 }
    )
  }

  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || config.app.defaultUserId

    const success = await vehicleService.deleteVehicle(userId, id)

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

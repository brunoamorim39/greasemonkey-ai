import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { vehicleService } from '@/lib/services/vehicle-service'
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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get user from auth header
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 })
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const vehicleId = params.id

    // Reactivate the vehicle using the service
    const reactivatedVehicle = await vehicleService.reactivateVehicle(user.id, vehicleId)

    if (!reactivatedVehicle) {
      return NextResponse.json({ error: 'Vehicle not found or cannot be reactivated' }, { status: 404 })
    }

    return NextResponse.json({
      vehicle: reactivatedVehicle,
      message: 'Vehicle reactivated successfully'
    })
  } catch (error: any) {
    console.error('Error reactivating vehicle:', error)

    // Check if it's a specific error we can handle
    if (error.message?.includes('limit reached') || error.message?.includes('Cannot reactivate')) {
      return NextResponse.json({ error: error.message }, { status: 429 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

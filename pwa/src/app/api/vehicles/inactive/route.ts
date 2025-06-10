import { NextRequest, NextResponse } from 'next/server'
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

export async function GET(request: NextRequest) {
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

    // Get inactive vehicles for this user
    const { data: vehicles, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', false)
      .order('deactivated_at', { ascending: false })

    if (error) {
      console.error('Error fetching inactive vehicles:', error)
      return NextResponse.json({ error: 'Failed to fetch inactive vehicles' }, { status: 500 })
    }

    return NextResponse.json({ vehicles: vehicles || [] })
  } catch (error) {
    console.error('Error in inactive vehicles API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

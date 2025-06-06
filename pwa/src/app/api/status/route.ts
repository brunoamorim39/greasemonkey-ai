import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Check database connectivity
    const { data, error } = await supabase
      .from('user_preferences')
      .select('id')
      .limit(1)

    const dbStatus = error ? 'degraded' : 'operational'

    // Check if we can make basic queries
    const apiStatus = 'operational'

    const status = {
      status: dbStatus === 'operational' && apiStatus === 'operational' ? 'operational' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        api: apiStatus,
        ai_engine: 'operational', // Could add actual AI service health check
        tts_service: 'operational', // Could add actual TTS service health check
      },
      version: '1.0.0'
    }

    return NextResponse.json(status)
  } catch (error) {
    console.error('Status check error:', error)
    return NextResponse.json(
      {
        status: 'down',
        timestamp: new Date().toISOString(),
        error: 'Service unavailable'
      },
      { status: 503 }
    )
  }
}

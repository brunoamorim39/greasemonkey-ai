import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/services/user-service'
import { UnitPreferences } from '@/lib/supabase/types'
import { withAuth } from '@/lib/auth' // Use the project's actual auth wrapper

const userService = new UserService()

async function getPreferencesHandler(request: NextRequest & { userId: string }) {
  try {
    const userId = request.userId // Get userId from the withAuth wrapper
    if (!userId) { // Should be handled by withAuth, but as a safeguard
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const preferences = await userService.getUserPreferences(userId)
    return NextResponse.json(preferences)
  } catch (error) {
    console.error('Error fetching user preferences:', error)
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 })
  }
}

async function updatePreferencesHandler(request: NextRequest & { userId: string }) {
  try {
    const userId = request.userId // Get userId from the withAuth wrapper
    if (!userId) { // Should be handled by withAuth, but as a safeguard
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as Partial<UnitPreferences> // Allow partial updates
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    // UserService.updateUserPreferences can handle partial updates and merge with existing prefs
    await userService.updateUserPreferences(userId, body)
    return NextResponse.json({ message: 'Preferences updated successfully' })
  } catch (error) {
    console.error('Error updating user preferences:', error)
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 })
  }
}

export const GET = withAuth(getPreferencesHandler)
export const PUT = withAuth(updatePreferencesHandler)

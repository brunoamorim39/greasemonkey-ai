import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Create admin client for server-side JWT verification
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function validateAuth(request: NextRequest): Promise<{ isValid: boolean; userId?: string; error?: string }> {
  // Get authorization header
  const authHeader = request.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      isValid: false,
      error: 'Authorization header required. Provide Authorization: Bearer <jwt_token>'
    }
  }

  const token = authHeader.substring(7) // Remove 'Bearer ' prefix

  try {
    // Verify JWT token with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

    if (error || !user) {
      return {
        isValid: false,
        error: 'Invalid or expired authentication token'
      }
    }

    return {
      isValid: true,
      userId: user.id
    }
  } catch (error) {
    return {
      isValid: false,
      error: 'Authentication verification failed'
    }
  }
}

export function withAuth<T extends unknown[]>(
  handler: (request: NextRequest & { userId: string }, ...args: T) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    const authResult = await validateAuth(request)

    if (!authResult.isValid) {
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      )
    }

    // Add userId to request object
    const authenticatedRequest = request as NextRequest & { userId: string }
    authenticatedRequest.userId = authResult.userId!

    return handler(authenticatedRequest, ...args)
  }
}

// Utility to create authenticated API responses
export function createAuthError(): NextResponse {
  return NextResponse.json(
    {
      error: 'Authentication required',
      message: 'Please provide a valid JWT token in the Authorization: Bearer header'
    },
    { status: 401 }
  )
}

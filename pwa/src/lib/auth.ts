import { NextRequest, NextResponse } from 'next/server'

export function validateApiKey(request: NextRequest): { isValid: boolean; error?: string } {
  const apiKey = process.env.API_KEY

  // If no API key is configured, allow all requests (development mode)
  if (!apiKey) {
    return { isValid: true }
  }

  // Check for API key in headers
  const providedKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '')

  if (!providedKey) {
    return {
      isValid: false,
      error: 'API key required. Provide x-api-key header or Authorization: Bearer <key>'
    }
  }

  if (providedKey !== apiKey) {
    return {
      isValid: false,
      error: 'Invalid API key'
    }
  }

  return { isValid: true }
}

export function withAuth(handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>) {
  return async (request: NextRequest, ...args: any[]): Promise<NextResponse> => {
    const authResult = validateApiKey(request)

    if (!authResult.isValid) {
      return NextResponse.json(
        { error: authResult.error },
        { status: 401 }
      )
    }

    return handler(request, ...args)
  }
}

// Utility to create authenticated API responses
export function createAuthError(): NextResponse {
  return NextResponse.json(
    {
      error: 'Authentication required',
      message: 'Please provide a valid API key in the x-api-key header or Authorization: Bearer header'
    },
    { status: 401 }
  )
}

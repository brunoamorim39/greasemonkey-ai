import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  // For now, just allow all routes and let client-side handle auth redirects
  // This is simpler and avoids middleware auth complexity
  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/chat', '/garage', '/documents', '/settings']
}

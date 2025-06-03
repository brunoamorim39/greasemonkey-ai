import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'GreaseMonkey AI PWA backend running',
    timestamp: new Date().toISOString()
  })
}

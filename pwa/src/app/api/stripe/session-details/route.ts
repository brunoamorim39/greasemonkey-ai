import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
    }

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription']
    })

    // Return relevant session data
    return NextResponse.json({
      id: session.id,
      mode: session.mode,
      status: session.status,
      metadata: session.metadata,
      subscription: session.subscription && typeof session.subscription === 'object' ? {
        id: session.subscription.id,
        status: session.subscription.status,
        trial_end: session.subscription.trial_end,
        current_period_end: session.subscription.current_period_end,
      } : null,
      setup_intent: session.setup_intent,
      customer: session.customer,
    })
  } catch (error) {
    console.error('Error fetching session details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch session details' },
      { status: 500 }
    )
  }
}

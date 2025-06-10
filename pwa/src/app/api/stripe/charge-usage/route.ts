import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { userId, questionCount = 1 } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Get user and their payment method
    const { data: user, error: userError } = await supabase
      .from('user_profiles')
      .select('*, stripe_customer_id, stripe_payment_method_id')
      .eq('id', userId)
      .single()

    // Get user tier from user_tiers table
    const { data: userTier } = await supabase
      .from('user_tiers')
      .select('tier')
      .eq('user_id', userId)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.stripe_customer_id || !user.stripe_payment_method_id) {
      return NextResponse.json({
        error: 'No payment method on file. Please set up billing first.'
      }, { status: 400 })
    }

        // Check if user is on Weekend Warrior plan
    const currentTier = userTier?.tier || user.tier || 'free_tier'
    if (currentTier !== 'weekend_warrior') {
      return NextResponse.json({
        error: 'Usage billing only applies to Weekend Warrior plan'
      }, { status: 400 })
    }

    // Calculate charge amount ($0.15 per question)
    const amountCents = questionCount * 15 // $0.15 = 15 cents

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      customer: user.stripe_customer_id,
      payment_method: user.stripe_payment_method_id,
      confirm: true,
      return_url: `${request.headers.get('origin')}/dashboard`,
      metadata: {
        userId: userId,
        questionCount: questionCount.toString(),
        planId: 'weekend_warrior',
      },
    })

    // Record the charge in usage_records table
    await supabase
      .from('usage_records')
      .insert({
        user_id: userId,
        usage_type: 'ask_query',
        details: {
          questions_charged: questionCount,
          amount_cents: amountCents,
          payment_intent_id: paymentIntent.id,
        },
        cost_cents: amountCents,
        timestamp: new Date().toISOString(),
      })

    return NextResponse.json({
      success: true,
      payment_intent_id: paymentIntent.id,
      amount_charged: amountCents,
    })
  } catch (error) {
    console.error('Error charging usage:', error)
    return NextResponse.json(
      { error: 'Failed to process payment' },
      { status: 500 }
    )
  }
}

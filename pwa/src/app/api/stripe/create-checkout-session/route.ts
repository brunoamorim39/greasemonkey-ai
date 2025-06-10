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
    const { planId, billingType, userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Get user from Supabase
    const { data: user, error: userError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    let session: Stripe.Checkout.Session

    if (planId === 'weekend_warrior') {
      // Usage-based pricing for Weekend Warrior
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'setup',
        customer_email: user.email,
        setup_intent_data: {
          metadata: {
            userId: userId,
            planId: planId,
          },
        },
        success_url: `${request.headers.get('origin')}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${request.headers.get('origin')}/pricing`,
        metadata: {
          userId: userId,
          planId: planId,
        },
        custom_text: {
          submit: {
            message: 'Add your payment method to get started with pay-per-question pricing'
          }
        },
        ui_mode: 'hosted',
        phone_number_collection: {
          enabled: false
        },
        billing_address_collection: 'auto',
      })
    } else if (planId === 'master_tech') {
      // Subscription pricing for Master Tech
      const priceId = billingType === 'yearly'
        ? process.env.STRIPE_MASTER_TECH_YEARLY_PRICE_ID
        : process.env.STRIPE_MASTER_TECH_MONTHLY_PRICE_ID

      if (!priceId) {
        return NextResponse.json({ error: 'Price ID not configured' }, { status: 500 })
      }

      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'subscription',
        customer_email: user.email,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${request.headers.get('origin')}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${request.headers.get('origin')}/pricing`,
        metadata: {
          userId: userId,
          planId: planId,
          billingType: billingType,
        },
        custom_text: {
          submit: {
            message: `Start your ${billingType} Master Tech subscription with unlimited questions`
          }
        },
        allow_promotion_codes: true, // Allow discount codes
        ui_mode: 'hosted',
        invoice_creation: {
          enabled: true,
        },
        phone_number_collection: {
          enabled: false
        },
        billing_address_collection: 'auto',
      })
    } else {
      return NextResponse.json({ error: 'Invalid plan ID' }, { status: 400 })
    }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

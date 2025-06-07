import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionCancelled(event.data.object as Stripe.Subscription)
        break

      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent)
        break

      case 'setup_intent.succeeded':
        await handleSetupIntentSucceeded(event.data.object as Stripe.SetupIntent)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId

  if (!userId) {
    console.error('No userId in session metadata')
    return
  }

  if (session.mode === 'subscription') {
    // Handle subscription checkout
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
    await updateUserSubscription(userId, subscription, session.metadata?.planId || 'master_tech')
  } else if (session.mode === 'setup') {
    // Handle payment method setup for Weekend Warrior
    const setupIntent = await stripe.setupIntents.retrieve(session.setup_intent as string)
    await updateUserPaymentMethod(userId, setupIntent, 'weekend_warrior')
  }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  // Find user by customer ID
  const { data: user } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('stripe_customer_id', subscription.customer)
    .single()

  if (user) {
    await updateUserSubscription(user.id, subscription, 'master_tech')
  }
}

async function handleSubscriptionCancelled(subscription: Stripe.Subscription) {
  const { data: user } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('stripe_customer_id', subscription.customer)
    .single()

  if (user) {
    // Update user_profiles
    await supabase
      .from('user_profiles')
      .update({
        subscription_status: 'cancelled',
        subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString()
      })
      .eq('id', user.id)

    // Update user_tiers
    await supabase
      .from('user_tiers')
      .update({ tier: 'free_tier' })
      .eq('user_id', user.id)
  }
}

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  // Usage-based payment succeeded - already recorded in charge-usage endpoint
  console.log('Payment succeeded:', paymentIntent.id)
}

async function handleSetupIntentSucceeded(setupIntent: Stripe.SetupIntent) {
  const userId = setupIntent.metadata?.userId

  if (userId && setupIntent.payment_method) {
    await updateUserPaymentMethod(userId, setupIntent, 'weekend_warrior')
  }
}

async function updateUserSubscription(userId: string, subscription: Stripe.Subscription, planId: string) {
  const profileUpdates = {
    subscription_status: subscription.status,
    subscription_id: subscription.id,
    subscription_start_date: new Date(subscription.current_period_start * 1000).toISOString(),
    subscription_end_date: new Date(subscription.current_period_end * 1000).toISOString(),
    stripe_customer_id: subscription.customer as string,
  }

  // Update user_profiles
  await supabase
    .from('user_profiles')
    .update(profileUpdates)
    .eq('id', userId)

  // Update user_tiers
  const tier = planId === 'master_tech' ? 'master_tech' : 'weekend_warrior'
  await supabase
    .from('user_tiers')
    .update({ tier })
    .eq('user_id', userId)
}

async function updateUserPaymentMethod(userId: string, setupIntent: Stripe.SetupIntent, planId: string) {
  const profileUpdates = {
    stripe_customer_id: setupIntent.customer as string,
    stripe_payment_method_id: setupIntent.payment_method as string,
  }

  // Update user_profiles
  await supabase
    .from('user_profiles')
    .update(profileUpdates)
    .eq('id', userId)

  // Update user_tiers
  await supabase
    .from('user_tiers')
    .update({ tier: planId })
    .eq('user_id', userId)
}

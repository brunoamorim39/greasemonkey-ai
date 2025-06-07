import { loadStripe } from '@stripe/stripe-js'

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export default stripePromise

export interface CheckoutSessionData {
  planId: string
  billingType?: 'monthly' | 'yearly'
  userId: string
}

export async function createCheckoutSession(data: CheckoutSessionData): Promise<string> {
  const response = await fetch('/api/stripe/create-checkout-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  const session = await response.json()

  if (!response.ok) {
    throw new Error(session.error || 'Failed to create checkout session')
  }

  return session.url
}

export async function chargeUsage(userId: string, questionCount: number = 1): Promise<boolean> {
  const response = await fetch('/api/stripe/charge-usage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId, questionCount }),
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Failed to charge usage')
  }

  return result.success
}

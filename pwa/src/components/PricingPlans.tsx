'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Button } from './ui/Button'
import {
  Check,
  Star,
  Zap,
  Crown,
  ArrowRight,
  FileText,
  Car,
  Mic,
  Upload,
  MessageSquare,
  Shield,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createCheckoutSession } from '@/lib/stripe'

interface PricingPlan {
  id: string
  name: string
  description: string
  monthlyPrice: number
  yearlyPrice: number
  icon: React.ReactNode
  badge?: string
  features: string[]
  limits: {
    questionsPerMonth: number | 'unlimited' | '3/day' | 'pay-per-use'
    vehicles: number | 'unlimited'
    documentsStorage: string
    audioResponses: boolean
    prioritySupport: boolean
  }
  popular?: boolean
}

const plans: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Get started with basic automotive assistance',
    monthlyPrice: 0,
    yearlyPrice: 0,
    icon: <Mic className="h-6 w-6" />,
    features: [
      '3 questions per day',
      '1 vehicle in garage',
      'Voice & text assistance',
      'No document uploads',
      'Community support'
    ],
    limits: {
      questionsPerMonth: '3/day',
      vehicles: 1,
      documentsStorage: '0 MB',
      audioResponses: true,
      prioritySupport: false
    }
  },
  {
    id: 'weekend_warrior',
    name: 'Weekend Warrior',
    description: 'Pay-as-you-go for DIY enthusiasts',
    monthlyPrice: 0, // Usage-based pricing
    yearlyPrice: 0,
    icon: <Car className="h-6 w-6" />,
    badge: 'Pay Per Use',
    popular: true,
    features: [
      '$0.15 per question',
      '3 vehicles in garage',
      'Voice & text assistance',
      '20 documents per vehicle',
      'Email support'
    ],
    limits: {
      questionsPerMonth: 'pay-per-use',
      vehicles: 3,
      documentsStorage: '20 docs/vehicle',
      audioResponses: true,
      prioritySupport: false
    }
  },
  {
    id: 'master_tech',
    name: 'Master Tech',
    description: 'For professionals and serious enthusiasts',
    monthlyPrice: 25,
    yearlyPrice: 250,
    icon: <Crown className="h-6 w-6" />,
    badge: 'Best Value',
    features: [
      '100 questions per month',
      'Unlimited vehicles',
      'Voice & text assistance',
      'Unlimited document uploads',
      'Priority support',
      'Advanced diagnostics'
    ],
    limits: {
      questionsPerMonth: 100,
      vehicles: 'unlimited',
      documentsStorage: 'Unlimited',
      audioResponses: true,
      prioritySupport: true
    }
  }
]

interface PricingPlansProps {
  currentPlan?: string
  userId?: string
  onSelectPlan?: (planId: string, billingType: 'monthly' | 'yearly') => void
  showCurrentPlan?: boolean
}

export function PricingPlans({
  currentPlan = 'free',
  userId,
  onSelectPlan,
  showCurrentPlan = false
}: PricingPlansProps) {
  const [billingType, setBillingType] = useState<'monthly' | 'yearly'>('monthly')
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const router = useRouter()

    const handleSelectPlan = async (planId: string) => {
    console.log('🎯 Button clicked for plan:', planId, 'User ID:', userId)

    if (planId === 'free') {
      // Free plan - no checkout needed
      console.log('🆓 Free plan selected')
      if (onSelectPlan) {
        onSelectPlan(planId, billingType)
      }
      return
    }

    if (!userId) {
      // Redirect to home page where AuthGuard will show login form
      console.log('❌ No user ID, redirecting to home')
      router.push('/')
      return
    }

    if (onSelectPlan) {
      // Custom handler provided
      console.log('🔧 Using custom handler')
      onSelectPlan(planId, billingType)
      return
    }

    // Default Stripe checkout flow
    console.log('💳 Starting Stripe checkout for:', planId, 'billingType:', billingType)
    try {
      setLoadingPlan(planId)

      console.log('📞 Calling createCheckoutSession...')
      const checkoutUrl = await createCheckoutSession({
        planId,
        billingType: planId === 'master_tech' ? billingType : undefined,
        userId
      })

      console.log('✅ Checkout URL received:', checkoutUrl)
      // Redirect to Stripe checkout
      window.location.href = checkoutUrl
    } catch (error) {
      console.error('❌ Error creating checkout session:', error)
      alert('Failed to start checkout. Please try again.')
    } finally {
      setLoadingPlan(null)
    }
  }

  const getPrice = (plan: PricingPlan) => {
    if (plan.monthlyPrice === 0) {
      if (plan.id === 'weekend_warrior') {
        return '$0.15'
      }
      return '$0'
    }

    const price = billingType === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice / 12
    return `$${price.toFixed(0)}`
  }

  const getYearlySavings = (plan: PricingPlan) => {
    if (plan.monthlyPrice === 0) return 0
    const yearlyTotal = plan.monthlyPrice * 12
    const savings = yearlyTotal - plan.yearlyPrice
    return Math.round((savings / yearlyTotal) * 100)
  }

  return (
    <div className="space-y-8">
      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {plans.map((plan) => {
          const isCurrentPlan = currentPlan === plan.id
          const savings = getYearlySavings(plan)
          const showBillingToggle = plan.id === 'master_tech' && plan.monthlyPrice > 0

          return (
            <Card
              key={plan.id}
              variant={plan.popular ? "elevated" : "glass"}
              className={cn(
                "relative transition-all duration-300 hover:scale-105",
                plan.popular && "border-orange-500/50 shadow-glow",
                isCurrentPlan && showCurrentPlan && "ring-2 ring-green-500"
              )}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-1 rounded-full text-sm font-medium shadow-lg">
                    {plan.badge}
                  </span>
                </div>
              )}

              {isCurrentPlan && showCurrentPlan && (
                <div className="absolute -top-3 right-4">
                  <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium shadow-lg">
                    Current Plan
                  </span>
                </div>
              )}

              <CardHeader className="text-center space-y-4 pb-4">
                <div className={cn(
                  "w-16 h-16 mx-auto rounded-2xl flex items-center justify-center",
                  plan.id === 'free' && "bg-zinc-700",
                  plan.id === 'weekend_warrior' && "bg-blue-600",
                  plan.id === 'master_tech' && "bg-gradient-to-r from-orange-500 to-red-500"
                )}>
                  <div className="text-white">
                    {plan.icon}
                  </div>
                </div>

                <div>
                  <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
                  <p className="text-zinc-400 text-sm">{plan.description}</p>
                </div>

                {/* Billing Toggle - Only for Master Tech */}
                {showBillingToggle && (
                  <div className="flex justify-center">
                    <div className="bg-zinc-800 p-1 rounded-xl border border-zinc-700">
                      <button
                        onClick={() => setBillingType('monthly')}
                        className={cn(
                          'px-4 py-1 rounded-lg text-sm font-medium transition-colors duration-150',
                          billingType === 'monthly'
                            ? 'bg-orange-500 text-white shadow-lg'
                            : 'text-zinc-400 hover:text-white'
                        )}
                      >
                        Monthly
                      </button>
                      <button
                        onClick={() => setBillingType('yearly')}
                        className={cn(
                          'px-4 py-1 rounded-lg text-sm font-medium transition-colors duration-150 relative',
                          billingType === 'yearly'
                            ? 'bg-orange-500 text-white shadow-lg'
                            : 'text-zinc-400 hover:text-white'
                        )}
                      >
                        Yearly
                        <span className="absolute -top-6 -right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                          Save 17%
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2 min-h-[100px] flex flex-col justify-center">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-4xl font-bold text-white">{getPrice(plan)}</span>
                    {plan.monthlyPrice > 0 ? (
                      <span className="text-zinc-400">
                        /{billingType === 'monthly' ? 'mo' : 'mo'}
                      </span>
                    ) : plan.id === 'weekend_warrior' ? (
                      <span className="text-zinc-400">/question</span>
                    ) : null}
                  </div>

                  {billingType === 'yearly' && plan.monthlyPrice > 0 && savings > 0 && (
                    <div className="text-center">
                      <span className="text-green-400 text-sm font-medium">
                        Save {savings}% annually
                      </span>
                    </div>
                  )}

                  {billingType === 'yearly' && plan.monthlyPrice > 0 && (
                    <div className="text-center">
                      <span className="text-zinc-500 text-sm line-through">
                        ${plan.monthlyPrice * 12}/year
                      </span>
                      <span className="text-white text-sm ml-2">
                        ${plan.yearlyPrice}/year
                      </span>
                    </div>
                  )}

                  {plan.id === 'weekend_warrior' && (
                    <div className="text-center">
                      <span className="text-green-400 text-sm font-medium">
                        Only pay for what you use
                      </span>
                    </div>
                  )}

                  {/* Spacer for free plan to align pricing sections */}
                  {plan.id === 'free' && (
                    <div className="text-center">
                      <span className="text-green-400 text-sm font-medium">
                        Forever free
                      </span>
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Features List */}
                <div className="space-y-3 min-h-[200px]">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <Check className="h-5 w-5 text-green-400 shrink-0" />
                      <span className="text-zinc-300 text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Limits */}
                <div className="pt-4 border-t border-zinc-700 space-y-2">
                  <h4 className="text-white font-medium text-sm">Plan Details:</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                    <div>Questions: {plan.limits.questionsPerMonth}</div>
                    <div>Vehicles: {plan.limits.vehicles}</div>
                    <div>Storage: {plan.limits.documentsStorage}</div>
                    <div>Priority: {plan.limits.prioritySupport ? 'Yes' : 'No'}</div>
                  </div>
                </div>

                {/* CTA Button */}
                <Button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={isCurrentPlan || loadingPlan === plan.id}
                  className={cn(
                    "w-full",
                    plan.popular && "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                  )}
                  variant={plan.popular ? "primary" : "outline"}
                  icon={loadingPlan === plan.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                >
                  {loadingPlan === plan.id
                    ? 'Processing...'
                    : isCurrentPlan
                      ? 'Current Plan'
                      : plan.id === 'free'
                        ? 'Get Started'
                        : plan.id === 'weekend_warrior'
                          ? 'Set Up Billing'
                          : 'Upgrade to ' + plan.name
                  }
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* FAQ Section */}
      <div className="max-w-4xl mx-auto">
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="text-center">Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-white font-medium mb-2">Can I change plans anytime?</h4>
                <p className="text-zinc-400 text-sm">
                  Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.
                </p>
              </div>
              <div>
                <h4 className="text-white font-medium mb-2">What happens to my data if I downgrade?</h4>
                <p className="text-zinc-400 text-sm">
                  Your data is safe. You'll just have access limits based on your new plan tier.
                </p>
              </div>
              <div>
                <h4 className="text-white font-medium mb-2">Is my payment information secure?</h4>
                <p className="text-zinc-400 text-sm">
                  Absolutely. We use Stripe for secure payment processing and never store your card details.
                </p>
              </div>
              <div>
                <h4 className="text-white font-medium mb-2">How does pay-per-use billing work?</h4>
                <p className="text-zinc-400 text-sm">
                  With the Weekend Warrior plan, you're only charged $0.15 for each question you ask. No monthly fees or commitments.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

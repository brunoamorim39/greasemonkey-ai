'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { PricingPlans } from '@/components/PricingPlans'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function PricingPage() {
  const [user, setUser] = useState<any>(null)
  const [currentPlan, setCurrentPlan] = useState<string>('free')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function getUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          setUser(user)

          // Get user's current plan from database
          const { data: userProfile } = await supabase
            .from('user_profiles')
            .select('tier')
            .eq('id', user.id)
            .single()

          if (userProfile?.tier) {
            setCurrentPlan(userProfile.tier)
          }
        }
      } catch (error) {
        console.error('Error fetching user:', error)
      } finally {
        setLoading(false)
      }
    }

    getUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user)

          // Fetch user plan
          const { data: userProfile } = await supabase
            .from('user_profiles')
            .select('tier')
            .eq('id', session.user.id)
            .single()

          if (userProfile?.tier) {
            setCurrentPlan(userProfile.tier)
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setCurrentPlan('free')
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
            Get the automotive expertise you need with our flexible pricing options.
            From casual DIY to professional use.
          </p>
        </div>

        <PricingPlans
          currentPlan={currentPlan}
          userId={user?.id}
          showCurrentPlan={true}
        />
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AuthGuard } from '@/components/AuthGuard'
import { LandingPage } from '@/components/LandingPage'
import { getCurrentUser } from '@/lib/supabase'
import type { User as SupabaseUser } from '@supabase/supabase-js'

function RedirectToChatComponent() {
  const router = useRouter()

  useEffect(() => {
    router.push('/chat')
  }, [router])

  return (
    <div className="h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-white">Redirecting...</div>
    </div>
  )
}

export default function Home() {
  const [showAuth, setShowAuth] = useState(false)

  if (!showAuth) {
    return <LandingPage onGetStarted={() => setShowAuth(true)} />
  }

  return (
    <AuthGuard>
      {(user: SupabaseUser) => <RedirectToChatComponent />}
    </AuthGuard>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Check, ArrowRight } from 'lucide-react'

export default function SuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [sessionData, setSessionData] = useState<any>(null)

  useEffect(() => {
    setMounted(true)
    const sessionIdParam = searchParams.get('session_id')
    setSessionId(sessionIdParam)

    // Try to get session details to show better messaging
    if (sessionIdParam) {
      fetch(`/api/stripe/session-details?session_id=${sessionIdParam}`)
        .then(res => res.json())
        .then(data => setSessionData(data))
        .catch(err => console.log('Could not fetch session details:', err))
    }
  }, [searchParams])

  if (!mounted) {
    return null // Prevent hydration issues
  }

  const isMasterTech = sessionData?.metadata?.planId === 'master_tech'
  const isWeekendWarrior = sessionData?.metadata?.planId === 'weekend_warrior'

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 flex items-center justify-center p-4">
      <Card variant="glass" className="max-w-md w-full text-center">
        <CardHeader className="space-y-6">
          <div className="w-20 h-20 mx-auto bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-glow">
            <Check className="h-10 w-10 text-white" strokeWidth={3} />
          </div>
          <div>
            <CardTitle className="text-3xl text-white mb-3">
              Payment Successful!
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {isWeekendWarrior && (
            <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
              <div className="text-center">
                <h3 className="text-blue-400 font-medium mb-1">Pay-Per-Question Billing</h3>
                <p className="text-zinc-300 text-sm">
                  You'll only be charged $0.15 for each question you ask. No monthly fees!
                </p>
              </div>
            </div>
          )}

          {sessionId && (
            <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg p-4">
              <p className="text-zinc-400 text-xs uppercase tracking-wide mb-2">Transaction ID</p>
              <p className="text-white text-sm font-mono break-all bg-zinc-900/50 p-2 rounded border">{sessionId}</p>
            </div>
          )}

          <div className="space-y-4">
            <Button
              onClick={() => router.push('/')}
              className="w-full py-3"
              variant="primary"
              icon={<ArrowRight className="h-5 w-5" />}
            >
              Start Asking Questions
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

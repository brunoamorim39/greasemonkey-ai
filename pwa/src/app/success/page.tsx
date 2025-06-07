'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Check, ArrowRight, Crown, Car } from 'lucide-react'

export default function SuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [sessionId, setSessionId] = useState<string | null>(null)

  useEffect(() => {
    const sessionIdParam = searchParams.get('session_id')
    setSessionId(sessionIdParam)
  }, [searchParams])

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 flex items-center justify-center p-4">
      <Card variant="glass" className="max-w-md w-full text-center">
        <CardHeader className="space-y-4">
          <div className="w-16 h-16 mx-auto bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
            <Check className="h-8 w-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl text-white mb-2">
              Payment Successful!
            </CardTitle>
            <p className="text-zinc-400">
              Welcome to GreaseMonkey AI! Your subscription has been activated.
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-left">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Car className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-white font-medium">Unlimited Questions</p>
                <p className="text-zinc-400 text-sm">Ask as many automotive questions as you need</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-left">
              <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
                <Crown className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-white font-medium">Premium Features</p>
                <p className="text-zinc-400 text-sm">Access to all advanced diagnostic tools</p>
              </div>
            </div>
          </div>

          {sessionId && (
            <div className="bg-zinc-800 rounded-lg p-3">
              <p className="text-zinc-400 text-xs">Session ID</p>
              <p className="text-white text-sm font-mono break-all">{sessionId}</p>
            </div>
          )}

          <div className="space-y-3">
            <Button
              onClick={() => router.push('/')}
              className="w-full"
              variant="primary"
              icon={<ArrowRight className="h-4 w-4" />}
            >
              Start Using GreaseMonkey AI
            </Button>

            <Button
              onClick={() => router.push('/dashboard')}
              className="w-full"
              variant="outline"
            >
              Go to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

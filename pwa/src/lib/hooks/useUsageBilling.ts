import { useState, useCallback } from 'react'
import { chargeUsage } from '@/lib/stripe'

interface UsageBillingResult {
  success: boolean
  error?: string
  requiresPaymentSetup?: boolean
}

export function useUsageBilling() {
  const [isCharging, setIsCharging] = useState(false)

  const chargeForUsage = useCallback(async (
    userId: string,
    questionCount: number = 1
  ): Promise<UsageBillingResult> => {
    if (isCharging) {
      return { success: false, error: 'Already processing payment' }
    }

    setIsCharging(true)

    try {
      await chargeUsage(userId, questionCount)
      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment failed'

      // Check if it's a payment setup issue
      const requiresPaymentSetup = errorMessage.includes('No payment method on file')

      return {
        success: false,
        error: errorMessage,
        requiresPaymentSetup
      }
    } finally {
      setIsCharging(false)
    }
  }, [isCharging])

  return {
    chargeForUsage,
    isCharging
  }
}

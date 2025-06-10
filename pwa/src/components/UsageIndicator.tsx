import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UserStats {
  tier: string
  usage: {
    daily: { ask_count: number }
    monthly: { ask_count: number }
    limits: {
      maxDailyAsks?: number
      maxMonthlyAsks?: number
    }
  }
}

interface UsageIndicatorProps {
  userStats: UserStats
  className?: string
}

export function UsageIndicator({ userStats, className }: UsageIndicatorProps) {
  const [showDetails, setShowDetails] = useState(false)

  const dailyUsage = userStats.usage.daily.ask_count
  const dailyLimit = userStats.usage.limits.maxDailyAsks
  const monthlyUsage = userStats.usage.monthly.ask_count
  const monthlyLimit = userStats.usage.limits.maxMonthlyAsks

  const getUsageColor = (used: number, limit?: number) => {
    if (!limit) return 'text-zinc-400'
    const percentage = (used / limit) * 100
    if (percentage >= 90) return 'text-red-400'
    if (percentage >= 70) return 'text-yellow-400'
    return 'text-green-400'
  }

  const getTierDisplayName = (tier: string) => {
    switch (tier) {
      case 'free_tier': return 'Free'
      case 'weekend_warrior': return 'Weekend Warrior'
      case 'master_tech': return 'Master Tech'
      default: return tier
    }
  }

  const isUsageBasedTier = (tier: string) => {
    return tier === 'weekend_warrior'
  }

  return (
    <div className={cn("relative usage-dropdown", className)}>
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-2 px-2 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
      >
        <Info className="h-4 w-4 ml-auto" />
        {!isUsageBasedTier(userStats.tier) && dailyLimit && (
          <span className={cn("text-xs", getUsageColor(dailyUsage, dailyLimit))}>
            {dailyUsage}/{dailyLimit}
          </span>
        )}
      </button>

      {showDetails && createPortal(
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setShowDetails(false)}
          />
          <div className="fixed top-16 right-4 w-72 max-w-[90vw] bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-[9999] p-4">
            <div className="flex items-center mb-3">
              <h3 className="text-white font-medium">Usage Status</h3>
              <button
                onClick={() => setShowDetails(false)}
                className="ml-auto -mr-3 flex h-3 w-3 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-zinc-400">Plan</span>
                  <span className="text-white">{getTierDisplayName(userStats.tier)}</span>
                </div>
              </div>

              {isUsageBasedTier(userStats.tier) ? (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-zinc-400">Today</span>
                      <span className="text-green-400">{dailyUsage} questions</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-zinc-400">This Month</span>
                      <span className="text-green-400">{monthlyUsage} questions</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {dailyLimit && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-zinc-400">Today</span>
                        <span className={getUsageColor(dailyUsage, dailyLimit)}>
                          {dailyUsage} / {dailyLimit} questions
                        </span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-2">
                        <div
                          className={cn(
                            "h-2 rounded-full transition-all",
                            getUsageColor(dailyUsage, dailyLimit).includes('red') ? 'bg-red-500' :
                            getUsageColor(dailyUsage, dailyLimit).includes('yellow') ? 'bg-yellow-500' :
                            'bg-green-500'
                          )}
                          style={{ width: `${Math.min((dailyUsage / dailyLimit) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {monthlyLimit && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-zinc-400">This Month</span>
                        <span className={getUsageColor(monthlyUsage, monthlyLimit)}>
                          {monthlyUsage} / {monthlyLimit} questions
                        </span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-2">
                        <div
                          className={cn(
                            "h-2 rounded-full transition-all",
                            getUsageColor(monthlyUsage, monthlyLimit).includes('red') ? 'bg-red-500' :
                            getUsageColor(monthlyUsage, monthlyLimit).includes('yellow') ? 'bg-yellow-500' :
                            'bg-green-500'
                          )}
                          style={{ width: `${Math.min((monthlyUsage / monthlyLimit) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

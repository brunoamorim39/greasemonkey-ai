import { Crown, Zap, User } from 'lucide-react'
import { Card, CardContent } from './ui/Card'

interface UsageStats {
  tier: string
  usage: {
    daily: { ask_count: number }
    monthly: { ask_count: number }
    limits: {
      maxDailyAsks?: number
      maxMonthlyAsks?: number
      maxDocumentUploads?: number
      maxVehicles?: number
    }
  }
}

interface UsageStatusProps {
  userStats: UsageStats
}

export function UsageStatus({ userStats }: UsageStatusProps) {
  const getTierDisplayName = (tier: string) => {
    const tierMap: Record<string, string> = {
      free_tier: 'Free',
      weekend_warrior: 'Weekend Warrior',
      master_tech: 'Master Tech'
    }
    return tierMap[tier] || tier
  }

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'free_tier':
        return <User className="h-4 w-4" />
      case 'weekend_warrior':
        return <Zap className="h-4 w-4" />
      case 'master_tech':
        return <Crown className="h-4 w-4" />
      default:
        return <User className="h-4 w-4" />
    }
  }

  const getTierColors = (tier: string) => {
    switch (tier) {
      case 'free_tier':
        return 'from-zinc-600 to-zinc-700 text-zinc-200'
      case 'weekend_warrior':
        return 'from-blue-500 to-blue-600 text-white'
      case 'master_tech':
        return 'from-purple-500 to-purple-600 text-white'
      default:
        return 'from-zinc-600 to-zinc-700 text-zinc-200'
    }
  }

  const getUsageProgress = (current: number, limit?: number) => {
    if (!limit) return { percentage: 0, status: 'unlimited' }
    const percentage = Math.min((current / limit) * 100, 100)
    let status: 'good' | 'warning' | 'critical' = 'good'

    if (percentage >= 90) status = 'critical'
    else if (percentage >= 70) status = 'warning'

    return { percentage, status }
  }

  const dailyProgress = getUsageProgress(userStats.usage.daily.ask_count, userStats.usage.limits.maxDailyAsks)

  return (
    <Card variant="glass">
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`bg-gradient-to-r ${getTierColors(userStats.tier)} px-3 py-1.5 rounded-full flex items-center gap-2 text-sm font-medium shadow-lg`}>
              {getTierIcon(userStats.tier)}
              {getTierDisplayName(userStats.tier)}
            </div>
          </div>

          <div className="text-right">
            <div className="text-sm text-zinc-400 mb-1">Questions today</div>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold">
                {userStats.usage.daily.ask_count}
                {userStats.usage.limits.maxDailyAsks && `/${userStats.usage.limits.maxDailyAsks}`}
              </span>

              {userStats.usage.limits.maxDailyAsks && (
                <div className="w-16 h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      dailyProgress.status === 'critical' ? 'bg-red-500' :
                      dailyProgress.status === 'warning' ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${dailyProgress.percentage}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

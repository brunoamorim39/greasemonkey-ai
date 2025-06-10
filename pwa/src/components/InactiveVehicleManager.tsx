'use client'

import { ArrowUp, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { getTierDisplayName } from '@/lib/utils/tier'
import { VehicleCard } from './VehicleCard'

interface BaseVehicle {
  id: string
  make: string
  model: string
  year: number
  nickname?: string
  trim?: string
  engine?: string
  mileage?: number
  is_active?: boolean
  deactivated_at?: string
  deactivation_reason?: string
  last_used_at?: string
}

interface InactiveVehicleManagerProps {
  inactiveVehicles: BaseVehicle[]
  currentTier: string
  className?: string
}

export function InactiveVehicleManager({
  inactiveVehicles,
  currentTier,
  className
}: InactiveVehicleManagerProps) {
  if (inactiveVehicles.length === 0) {
    return null
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <Card className="border-yellow-500/30 bg-yellow-500/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0" />
            <div>
              <h3 className="text-yellow-400 font-medium">
                {inactiveVehicles.length} Inactive Vehicle{inactiveVehicles.length !== 1 ? 's' : ''}
              </h3>
              <p className="text-sm text-zinc-400">
                These vehicles are temporarily inaccessible due to your current plan limits
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upgrade Prompt */}
      <Card className="border-orange-500/30 bg-orange-500/10">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <ArrowUp className="h-5 w-5 text-orange-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="text-orange-400 font-medium mb-1">Upgrade to Reactivate</h4>
              <p className="text-sm text-zinc-400 mb-3">
                Your {getTierDisplayName(currentTier)} plan doesn't allow additional vehicles.
                Upgrade to automatically reactivate these vehicles.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                onClick={() => window.dispatchEvent(new CustomEvent('showPricing'))}
              >
                <ArrowUp className="h-4 w-4 mr-2" />
                Upgrade Plan
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inactive Vehicles List */}
      <div className="grid gap-3">
        {inactiveVehicles.map((vehicle) => (
          <VehicleCard
            key={vehicle.id}
            vehicle={vehicle}
            status="inactive"
          />
        ))}
      </div>

      {/* Bottom Notice */}
      <div className="text-center text-sm text-zinc-500 mt-4">
        <p>
          Your vehicles are safely stored and will be automatically restored when you upgrade.
          No data will be lost.
        </p>
      </div>
    </div>
  )
}

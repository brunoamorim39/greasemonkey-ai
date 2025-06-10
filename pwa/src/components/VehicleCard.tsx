'use client'

import { Car, Edit3, Trash2, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface BaseVehicle {
  id: string
  make: string
  model: string
  year: number
  nickname?: string
  trim?: string
  engine?: string
  mileage?: number
  notes?: string
  is_active?: boolean
  deactivated_at?: string
  deactivation_reason?: string
  last_used_at?: string
}

interface VehicleCardProps {
  vehicle: BaseVehicle
  status: 'active' | 'inactive'
  isSelected?: boolean
  onClick?: () => void
  onEdit?: () => void
  onDelete?: () => void
  className?: string
}

export function VehicleCard({
  vehicle,
  status,
  isSelected = false,
  onClick,
  onEdit,
  onDelete,
  className
}: VehicleCardProps) {
  const getVehicleDisplayName = () => {
    return vehicle.nickname || `${vehicle.year} ${vehicle.make} ${vehicle.model}`
  }

  const getDeactivationReason = () => {
    if (vehicle.deactivation_reason === 'tier_downgrade') {
      return 'Deactivated due to plan downgrade'
    }
    return 'Deactivated'
  }

  const cardClass = cn(
    "transition-all duration-200 cursor-pointer hover:bg-zinc-900/50 overflow-hidden",
    status === 'active' && isSelected && "ring-2 ring-orange-500 bg-orange-500/5",
    status === 'inactive' && "border-zinc-700 bg-zinc-900/50 opacity-75",
    className
  )

  return (
    <Card className={cardClass} onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              status === 'active'
                ? "bg-gradient-to-r from-orange-500 to-red-500"
                : "bg-zinc-800"
            )}>
              <Car className={cn(
                "h-5 w-5",
                status === 'active' ? "text-white" : "text-zinc-500"
              )} />
            </div>
            <div className="min-w-0">
              <h4 className="text-white font-medium break-words">
                {getVehicleDisplayName()}
              </h4>
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                {vehicle.nickname ? (
                  <>
                    <span>{vehicle.year} {vehicle.make} {vehicle.model}</span>
                    {vehicle.trim && <span>{vehicle.trim}</span>}
                  </>
                ) : (
                  vehicle.trim && <span>{vehicle.trim}</span>
                )}
              </div>
              {status === 'inactive' && (
                <p className="text-xs text-yellow-400 mt-1">
                  {getDeactivationReason()}
                </p>
              )}
            </div>
          </div>

          {status === 'active' && isSelected && (
            <div className="flex items-center gap-1 px-2 py-1 bg-orange-500 rounded text-xs font-medium text-white">
              <CheckCircle2 className="h-3 w-3" />
              Active
            </div>
          )}
        </div>

        {/* Vehicle Details */}
        <div className="pt-3 border-t border-zinc-800">
          <div className="grid grid-cols-2 gap-2 text-sm mb-3">
            <div>
              <span className="text-zinc-500">Year:</span>
              <span className="text-zinc-300 ml-2">{vehicle.year}</span>
            </div>
            {vehicle.engine && (
              <div>
                <span className="text-zinc-500">Engine:</span>
                <span className="text-zinc-300 ml-2">{vehicle.engine}</span>
              </div>
            )}
            {vehicle.mileage && (
              <div>
                <span className="text-zinc-500">Mileage:</span>
                <span className="text-zinc-300 ml-2">{vehicle.mileage.toLocaleString()}</span>
              </div>
            )}
            {status === 'inactive' && vehicle.deactivated_at && (
              <div>
                <span className="text-zinc-500">Deactivated:</span>
                <span className="text-zinc-300 ml-2">
                  {new Date(vehicle.deactivated_at).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {vehicle.notes && (
            <div className="mb-3">
              <span className="text-zinc-500 text-sm">Notes:</span>
              <p className="text-zinc-300 text-sm mt-1 line-clamp-2">{vehicle.notes}</p>
            </div>
          )}

          {/* Action Buttons - Only for active vehicles */}
          {status === 'active' && (onEdit || onDelete) && (
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800/50">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit()
                  }}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-800 text-zinc-400 hover:text-white"
                >
                  <Edit3 className="h-4 w-4" />
                  <span className="text-xs">Edit</span>
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete()
                  }}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-red-500/20 hover:text-red-400 text-zinc-400"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="text-xs">Delete</span>
                </Button>
              )}
            </div>
          )}

          {/* Inactive vehicle notice */}
          {status === 'inactive' && (
            <div className="pt-2 border-t border-zinc-800/50">
              <p className="text-center text-xs text-zinc-500">
                Will automatically reactivate when you upgrade your plan
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

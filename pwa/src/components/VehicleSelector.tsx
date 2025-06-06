import { useState } from 'react'
import { ChevronDown, Car, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Vehicle {
  id: string
  displayName: string
  nickname?: string
  make: string
  model: string
  year: number
  trim?: string
}

interface VehicleSelectorProps {
  vehicles: Vehicle[]
  selectedVehicle: string
  onVehicleSelect: (vehicleId: string) => void
  className?: string
}

export function VehicleSelector({
  vehicles,
  selectedVehicle,
  onVehicleSelect,
  className
}: VehicleSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  const selectedVehicleData = vehicles.find(v => v.id === selectedVehicle)

  const getDisplayName = (vehicle: Vehicle) => {
    if (vehicle.nickname) {
      return vehicle.nickname
    }
    return `${vehicle.year} ${vehicle.make} ${vehicle.model}`
  }

  const getSubtitle = (vehicle: Vehicle) => {
    if (vehicle.nickname) {
      return `${vehicle.year} ${vehicle.make} ${vehicle.model}`
    }
    return vehicle.trim || ''
  }

  if (vehicles.length === 0) return null

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-zinc-900/30 hover:bg-zinc-800/50 rounded-xl border border-zinc-800/50 transition-all text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Car className="h-4 w-4 text-orange-400 flex-shrink-0" />
          <div className="min-w-0">
            {selectedVehicleData ? (
              <>
                <div className="text-white text-sm font-medium truncate">
                  {getDisplayName(selectedVehicleData)}
                </div>
                {getSubtitle(selectedVehicleData) && (
                  <div className="text-zinc-500 text-xs truncate">
                    {getSubtitle(selectedVehicleData)}
                  </div>
                )}
              </>
            ) : (
              <div className="text-zinc-400 text-sm">Select vehicle</div>
            )}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-zinc-400 transition-transform flex-shrink-0",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-20 max-h-64 overflow-y-auto">
            {vehicles.map((vehicle) => (
              <button
                key={vehicle.id}
                onClick={() => {
                  onVehicleSelect(vehicle.id)
                  setIsOpen(false)
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 hover:bg-zinc-800 transition-all text-left",
                  selectedVehicle === vehicle.id && "bg-orange-500/10"
                )}
              >
                <Car className="h-4 w-4 text-orange-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate">
                    {getDisplayName(vehicle)}
                  </div>
                  {getSubtitle(vehicle) && (
                    <div className="text-zinc-500 text-xs truncate">
                      {getSubtitle(vehicle)}
                    </div>
                  )}
                </div>
                {selectedVehicle === vehicle.id && (
                  <Check className="h-4 w-4 text-orange-400 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

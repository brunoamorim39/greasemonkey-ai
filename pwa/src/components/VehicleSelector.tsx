import { Car, ChevronDown } from 'lucide-react'
import { Card, CardContent } from './ui/Card'

interface Vehicle {
  id: string
  displayName: string
  make: string
  model: string
  year: number
}

interface VehicleSelectorProps {
  vehicles: Vehicle[]
  selectedVehicle: string
  onVehicleChange: (vehicleId: string) => void
}

export function VehicleSelector({ vehicles, selectedVehicle, onVehicleChange }: VehicleSelectorProps) {
  if (vehicles.length === 0) return null

  return (
    <Card variant="glass" className="relative">
      <CardContent className="py-4">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-orange-500 to-red-500 p-2 rounded-lg shadow-lg shrink-0">
            <Car className="h-5 w-5 text-white" />
          </div>
          <div className="relative flex-1">
            <select
              value={selectedVehicle}
              onChange={(e) => onVehicleChange(e.target.value)}
              className="w-full bg-transparent text-white focus:outline-none appearance-none cursor-pointer text-lg font-medium pr-8"
            >
              <option value="" className="bg-zinc-900 text-zinc-300">
                Select your vehicle (optional)
              </option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id} className="bg-zinc-900 text-white">
                  {vehicle.displayName}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 pointer-events-none" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

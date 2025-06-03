import { createClient } from '@supabase/supabase-js'
import { Database, Vehicle } from '../supabase/types'
import { userService } from './user-service'
import { TIER_LIMITS } from '../config'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface CreateVehicleRequest {
  make: string
  model: string
  year: number
  trim?: string
  engine?: string
  vin?: string
  notes?: string
}

export interface UpdateVehicleRequest {
  make?: string
  model?: string
  year?: number
  trim?: string
  engine?: string
  vin?: string
  notes?: string
}

export class VehicleService {
  async getUserVehicles(userId: string): Promise<Vehicle[]> {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching user vehicles:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error in getUserVehicles:', error)
      return []
    }
  }

  async getVehicle(userId: string, vehicleId: string): Promise<Vehicle | null> {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', userId)
        .eq('id', vehicleId)
        .single()

      if (error) {
        console.error('Error fetching vehicle:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error in getVehicle:', error)
      return null
    }
  }

  async createVehicle(userId: string, vehicleData: CreateVehicleRequest): Promise<Vehicle | null> {
    try {
      // Check vehicle limit
      const currentVehicles = await this.getUserVehicles(userId)
      const tier = await userService.getUserTier(userId)
      const limits = TIER_LIMITS[tier]

      if (limits.maxVehicles !== null && currentVehicles.length >= limits.maxVehicles) {
        throw new Error(`Vehicle limit reached (${currentVehicles.length}/${limits.maxVehicles}). Upgrade your plan for unlimited vehicles.`)
      }

      const { data, error } = await supabase
        .from('vehicles')
        .insert({
          user_id: userId,
          ...vehicleData,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating vehicle:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in createVehicle:', error)
      throw error
    }
  }

  async updateVehicle(userId: string, vehicleId: string, vehicleData: UpdateVehicleRequest): Promise<Vehicle | null> {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .update({
          ...vehicleData,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('id', vehicleId)
        .select()
        .single()

      if (error) {
        console.error('Error updating vehicle:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in updateVehicle:', error)
      throw error
    }
  }

  async deleteVehicle(userId: string, vehicleId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('user_id', userId)
        .eq('id', vehicleId)

      if (error) {
        console.error('Error deleting vehicle:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in deleteVehicle:', error)
      return false
    }
  }

  async canAddVehicle(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const currentVehicles = await this.getUserVehicles(userId)
      const tier = await userService.getUserTier(userId)
      const limits = TIER_LIMITS[tier]

      if (limits.maxVehicles !== null && currentVehicles.length >= limits.maxVehicles) {
        return {
          allowed: false,
          reason: `Vehicle limit reached (${currentVehicles.length}/${limits.maxVehicles}). Upgrade your plan for unlimited vehicles.`
        }
      }

      return { allowed: true }
    } catch (error) {
      console.error('Error checking vehicle limit:', error)
      return { allowed: false, reason: 'Error checking vehicle limits' }
    }
  }

  formatVehicleString(vehicle: Vehicle): string {
    const parts = [vehicle.year.toString(), vehicle.make, vehicle.model]
    if (vehicle.trim) {
      parts.push(vehicle.trim)
    }
    return parts.join(' ')
  }

  formatVehicleForGPT(vehicle: Vehicle): string {
    const parts = [vehicle.year.toString(), vehicle.make, vehicle.model]
    if (vehicle.trim) {
      parts.push(vehicle.trim)
    }
    if (vehicle.engine) {
      parts.push(`(${vehicle.engine})`)
    }
    return parts.join(' ')
  }

  // Parse vehicle string from user input (e.g., "2018 Toyota Camry SE")
  parseVehicleString(vehicleString: string): Partial<CreateVehicleRequest> | null {
    const trimmed = vehicleString.trim()
    if (!trimmed) return null

    const parts = trimmed.split(' ')
    if (parts.length < 3) return null

    const year = parseInt(parts[0])
    if (isNaN(year) || year < 1900 || year > new Date().getFullYear() + 2) {
      return null
    }

    const make = parts[1]
    const model = parts.slice(2).join(' ')

    return {
      year,
      make,
      model,
    }
  }

  // Get popular makes for autocomplete
  getPopularMakes(): string[] {
    return [
      'Acura', 'Audi', 'BMW', 'Buick', 'Cadillac', 'Chevrolet', 'Chrysler',
      'Dodge', 'Ford', 'GMC', 'Honda', 'Hyundai', 'Infiniti', 'Jeep',
      'Kia', 'Lexus', 'Lincoln', 'Mazda', 'Mercedes-Benz', 'Mitsubishi',
      'Nissan', 'Porsche', 'Ram', 'Subaru', 'Tesla', 'Toyota', 'Volkswagen', 'Volvo'
    ].sort()
  }

  // Validate VIN format (basic check)
  validateVIN(vin: string): boolean {
    if (!vin) return true // VIN is optional

    // Remove spaces and convert to uppercase
    const cleanVIN = vin.replace(/\s/g, '').toUpperCase()

    // VIN should be exactly 17 characters
    if (cleanVIN.length !== 17) return false

    // VIN should not contain I, O, or Q
    if (/[IOQ]/.test(cleanVIN)) return false

    // VIN should only contain alphanumeric characters
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(cleanVIN)) return false

    return true
  }
}

export const vehicleService = new VehicleService()

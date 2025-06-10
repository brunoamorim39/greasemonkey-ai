import { createClient } from '@supabase/supabase-js'
import { Database, Vehicle } from '../supabase/types'
import { userService } from './user-service'
import { TIER_LIMITS } from '../config'

// Create service role client for backend operations (bypasses RLS)
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
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
  async getUserVehicles(userId: string, includeInactive: boolean = false): Promise<Vehicle[]> {
    try {
      let query = supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', userId)
        .order('last_used_at', { ascending: false, nullsFirst: false })

      if (!includeInactive) {
        query = query.eq('is_active', true)
        console.log('🚗 Filtering vehicles to only show active ones')
      } else {
        console.log('🚗 Loading ALL vehicles (including inactive)')
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching vehicles:', error)
        throw error
      }

      console.log(`🚗 Loaded ${data?.length || 0} vehicles for user ${userId} (includeInactive: ${includeInactive})`)
      if (data && data.length > 0) {
        console.log('🚗 Vehicle is_active values:', data.map(v => ({ id: v.id, make: v.make, model: v.model, is_active: v.is_active })))
      }

      return data || []
    } catch (error) {
      console.error('Error in getUserVehicles:', error)
      throw error
    }
  }

  async getInactiveVehicles(userId: string): Promise<Vehicle[]> {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', false)
        .order('deactivated_at', { ascending: false })

      if (error) {
        console.error('Error fetching inactive vehicles:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getInactiveVehicles:', error)
      throw error
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
      // First, delete all documents associated with this vehicle
      const { data: documents } = await supabase
        .from('documents')
        .select('id')
        .eq('user_id', userId)
        .eq('vehicle_id', vehicleId)

      if (documents && documents.length > 0) {
        // Delete document files from storage
        for (const doc of documents) {
          await this.deleteDocumentFile(userId, doc.id)
        }

        // Delete document records
        await supabase
          .from('documents')
          .delete()
          .eq('user_id', userId)
          .eq('vehicle_id', vehicleId)
      }

      // Delete the vehicle
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', vehicleId)
        .eq('user_id', userId)

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

  private async deleteDocumentFile(userId: string, documentId: string): Promise<void> {
    try {
      // Get document storage path
      const { data: doc } = await supabase
        .from('documents')
        .select('storage_path')
        .eq('id', documentId)
        .eq('user_id', userId)
        .single()

      if (doc?.storage_path) {
        // Delete file from storage
        await supabase.storage
          .from('documents')
          .remove([doc.storage_path])
      }
    } catch (error) {
      console.error('Error deleting document file:', error)
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

  async reactivateVehicle(userId: string, vehicleId: string): Promise<Vehicle | null> {
    try {
      // Check if user can add this vehicle back
      const canAdd = await this.canAddVehicle(userId)
      if (!canAdd.allowed) {
        throw new Error(canAdd.reason || 'Cannot reactivate vehicle')
      }

      const { data, error } = await supabase
        .from('vehicles')
        .update({
          is_active: true,
          deactivated_at: null,
          deactivation_reason: null,
          last_used_at: new Date().toISOString()
        })
        .eq('id', vehicleId)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        console.error('Error reactivating vehicle:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in reactivateVehicle:', error)
      throw error
    }
  }
}

export const vehicleService = new VehicleService()

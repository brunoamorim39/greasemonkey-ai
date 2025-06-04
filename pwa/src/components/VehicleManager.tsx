'use client'

import { useState } from 'react'
import { Car, Plus, Edit, Trash2, Heart, Calendar, Settings } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { cn } from '@/lib/utils'
import type { Database } from '@/lib/supabase'
import React from 'react'

type VehicleInsert = Database['public']['Tables']['vehicles']['Insert']

interface Vehicle {
  id: string
  displayName: string
  nickname?: string
  make: string
  model: string
  year: number
  trim?: string
  engine?: string
  notes?: string
  mileage?: number
}

interface VehicleManagerProps {
  vehicles: Vehicle[]
  onCreateVehicle: (vehicle: Omit<Vehicle, 'id'>) => Promise<void>
  onUpdateVehicle: (id: string, vehicle: Partial<Vehicle>) => Promise<void>
  onDeleteVehicle: (id: string) => Promise<void>
  selectedVehicle?: string
  onVehicleSelect?: (vehicleId: string) => void
  userStats?: {
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
    vehicles: {
      count: number
      vehicles: Vehicle[]
    }
    documents: {
      count: number
      storageUsedMB: number
      documents: any[]
    }
  } | null
}

export function VehicleManager({
  vehicles,
  onCreateVehicle,
  onUpdateVehicle,
  onDeleteVehicle,
  selectedVehicle,
  onVehicleSelect,
  userStats
}: VehicleManagerProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<string | null>(null)
  const [newVehicle, setNewVehicle] = useState<Partial<Vehicle>>({
    make: '',
    model: '',
    year: new Date().getFullYear(),
    nickname: ''
  })

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newVehicle.make || !newVehicle.model || !newVehicle.year) return

    try {
      // Create the vehicle data according to the database schema
      const vehicleData: Omit<VehicleInsert, 'user_id'> = {
        make: newVehicle.make!,
        model: newVehicle.model!,
        year: newVehicle.year!,
        nickname: newVehicle.nickname || null,
        trim: null,
        engine: null,
        notes: null,
        mileage: null
      }

      await onCreateVehicle(vehicleData as any)

      setNewVehicle({
        make: '',
        model: '',
        year: new Date().getFullYear(),
        nickname: ''
      })
      setIsAdding(false)
    } catch (error) {
      console.error('Failed to create vehicle:', error)
    }
  }

  const handleUpdateVehicle = async (vehicleId: string, updates: Partial<Vehicle>) => {
    try {
      // Remove displayName from updates since it doesn't exist in the database
      // displayName is computed on the frontend from make, model, year, and trim
      const { displayName, ...dbUpdates } = updates

      await onUpdateVehicle(vehicleId, dbUpdates)
      setEditingVehicle(null)
    } catch (error) {
      console.error('Failed to update vehicle:', error)
    }
  }

  const handleDeleteVehicle = async (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId)
    if (!vehicle) return

    const confirmed = confirm(
      `Are you sure you want to delete "${vehicle.displayName}"${vehicle.nickname ? ` (${vehicle.nickname})` : ''}? This action cannot be undone.`
    )

    if (confirmed) {
      try {
        await onDeleteVehicle(vehicleId)
      } catch (error) {
        console.error('Failed to delete vehicle:', error)
      }
    }
  }

  const getVehicleDisplayName = (vehicle: Vehicle) => {
    if (vehicle.nickname) {
      return `${vehicle.nickname} (${vehicle.displayName})`
    }
    return vehicle.displayName
  }

  // Get vehicle limits
  const maxVehicles = userStats?.usage?.limits?.maxVehicles
  const currentVehicles = vehicles.length
  const isAtVehicleLimit = maxVehicles !== undefined && maxVehicles !== null && currentVehicles >= maxVehicles
  const tier = userStats?.tier || 'free_tier'

  // Format tier display name
  const getTierDisplayName = (tierName: string) => {
    switch (tierName) {
      case 'free_tier': return 'Free Tier'
      case 'weekend_warrior': return 'Weekend Warrior'
      case 'master_tech': return 'Master Tech'
      default: return tierName
    }
  }

  return (
    <div className="space-y-6">
      {/* Vehicle List */}
      <Card variant="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3">
              <Car className="h-6 w-6 text-orange-500" />
              <div className="flex flex-col">
                <span>Your Garage</span>
                <div className="flex items-center gap-2 text-sm font-normal">
                  <span className="text-zinc-400">
                    {currentVehicles}{maxVehicles !== undefined && maxVehicles !== null ? `/${maxVehicles}` : ''} vehicles
                  </span>
                  <span className="text-xs text-zinc-500">•</span>
                  <span className="text-xs text-zinc-500">{getTierDisplayName(tier)}</span>
                </div>
              </div>
            </CardTitle>

            {/* Upgrade hint when at limit */}
            {isAtVehicleLimit && (
              <div className="text-center">
                <p className="text-sm text-orange-400 mb-2">Vehicle limit reached</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                >
                  Upgrade Plan
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {vehicles.length > 0 ? (
            <div className="grid gap-4">
              {vehicles.map((vehicle) => (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  isSelected={selectedVehicle === vehicle.id}
                  isEditing={editingVehicle === vehicle.id}
                  onSelect={() => onVehicleSelect?.(vehicle.id)}
                  onEdit={() => setEditingVehicle(vehicle.id)}
                  onSave={(updates) => handleUpdateVehicle(vehicle.id, updates)}
                  onCancel={() => setEditingVehicle(null)}
                  onDelete={() => handleDeleteVehicle(vehicle.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Car className="h-16 w-16 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400 text-lg mb-2">No vehicles in your garage yet</p>
              <p className="text-zinc-500 text-sm">Add your first vehicle below to get personalized automotive assistance!</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Vehicle Form */}
      <Card variant="elevated">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3">
              <Plus className="h-6 w-6 text-orange-500" />
              Add New Vehicle
            </CardTitle>
            {!isAdding && (
              <Button
                onClick={() => setIsAdding(true)}
                size="sm"
                disabled={isAtVehicleLimit}
                className={isAtVehicleLimit ? 'opacity-50 cursor-not-allowed' : ''}
              >
                Add Vehicle
              </Button>
            )}
          </div>

          {/* Limit warning */}
          {isAtVehicleLimit && (
            <div className="mt-3 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
              <div className="flex items-center gap-2 text-orange-400 text-sm">
                <Car className="h-4 w-4" />
                <span className="font-medium">Vehicle limit reached ({currentVehicles}/{maxVehicles})</span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                You've reached the maximum number of vehicles for the {getTierDisplayName(tier)}.
                Upgrade your plan to add more vehicles to your garage.
              </p>
            </div>
          )}
        </CardHeader>

        {isAdding && (
          <CardContent>
            <form onSubmit={handleCreateVehicle} className="space-y-4">
              {/* Basic Info Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  placeholder="Make (e.g., Toyota)"
                  value={newVehicle.make || ''}
                  onChange={(e) => setNewVehicle({ ...newVehicle, make: e.target.value })}
                  required
                />
                <Input
                  placeholder="Model (e.g., Camry)"
                  value={newVehicle.model || ''}
                  onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                  required
                />
                <Input
                  type="number"
                  placeholder="Year"
                  value={newVehicle.year || ''}
                  onChange={(e) => setNewVehicle({ ...newVehicle, year: parseInt(e.target.value) || new Date().getFullYear() })}
                  min="1900"
                  max={new Date().getFullYear() + 2}
                  required
                />
              </div>

              {/* Nickname */}
              <div>
                <Input
                  placeholder="Nickname (optional, e.g., 'Blue Beast', 'Daily Driver')"
                  value={newVehicle.nickname || ''}
                  onChange={(e) => setNewVehicle({ ...newVehicle, nickname: e.target.value })}
                />
                <p className="text-xs text-zinc-500 mt-1">Give your vehicle a personal nickname</p>
              </div>

              {/* Form Actions */}
              <div className="flex gap-3">
                <Button type="submit" className="flex-1">
                  Add Vehicle
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsAdding(false)
                    setNewVehicle({
                      make: '',
                      model: '',
                      year: new Date().getFullYear(),
                      nickname: ''
                    })
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        )}
      </Card>
    </div>
  )
}

interface VehicleCardProps {
  vehicle: Vehicle
  isSelected: boolean
  isEditing: boolean
  onSelect: () => void
  onEdit: () => void
  onSave: (updates: Partial<Vehicle>) => void
  onCancel: () => void
  onDelete: () => void
}

function VehicleCard({
  vehicle,
  isSelected,
  isEditing,
  onSelect,
  onEdit,
  onSave,
  onCancel,
  onDelete
}: VehicleCardProps) {
  const [editData, setEditData] = useState<Partial<Vehicle>>({})

  // Reset editData whenever editing mode is entered
  React.useEffect(() => {
    if (isEditing) {
      setEditData({
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        nickname: vehicle.nickname || '',
        trim: vehicle.trim || '',
        engine: vehicle.engine || '',
        mileage: vehicle.mileage,
        notes: vehicle.notes || ''
      })
    }
  }, [isEditing, vehicle])

  const handleSave = () => {
    onSave(editData)
  }

  if (isEditing) {
    return (
      <Card variant="elevated" className="border-orange-500/50">
        <CardContent className="py-4">
          <div className="space-y-4">
            <h3 className="font-semibold text-white">Edit Vehicle</h3>

            {/* Basic vehicle info - make, model, year */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                placeholder="Make"
                value={editData.make || ''}
                onChange={(e) => setEditData({ ...editData, make: e.target.value })}
                required
              />
              <Input
                placeholder="Model"
                value={editData.model || ''}
                onChange={(e) => setEditData({ ...editData, model: e.target.value })}
                required
              />
              <Input
                type="number"
                placeholder="Year"
                value={editData.year || ''}
                onChange={(e) => setEditData({ ...editData, year: parseInt(e.target.value) || new Date().getFullYear() })}
                min="1900"
                max={new Date().getFullYear() + 2}
                required
              />
            </div>

            {/* Additional details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                placeholder="Nickname (optional)"
                value={editData.nickname || ''}
                onChange={(e) => setEditData({ ...editData, nickname: e.target.value })}
              />
              <Input
                placeholder="Trim (optional)"
                value={editData.trim || ''}
                onChange={(e) => setEditData({ ...editData, trim: e.target.value })}
              />
              <Input
                placeholder="Engine (optional)"
                value={editData.engine || ''}
                onChange={(e) => setEditData({ ...editData, engine: e.target.value })}
              />
              <Input
                type="number"
                placeholder="Current mileage (optional)"
                value={editData.mileage || ''}
                onChange={(e) => setEditData({ ...editData, mileage: parseInt(e.target.value) || undefined })}
              />
            </div>

            <textarea
              placeholder="Notes (optional)"
              value={editData.notes || ''}
              onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
              className="w-full bg-zinc-900/50 border border-zinc-700 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 placeholder:text-zinc-500 resize-none transition-all duration-200"
              rows={2}
            />

            <div className="flex gap-2">
              <Button onClick={handleSave} size="sm" className="flex-1">
                Save Changes
              </Button>
              <Button onClick={onCancel} variant="outline" size="sm">
                Cancel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      variant="default"
      className={cn(
        "card-hover cursor-pointer transition-all duration-200",
        isSelected && "ring-2 ring-orange-500 bg-orange-500/5"
      )}
      onClick={onSelect}
    >
      <CardContent className="py-4">
        <div className="flex justify-between items-start">
          <div className="flex items-start gap-3 flex-1">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 p-2 rounded-lg shrink-0">
              <Car className="h-5 w-5 text-white" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-white truncate">{vehicle.displayName}</h3>
                {isSelected && (
                  <span className="text-xs bg-orange-500 text-white px-2 py-1 rounded-full">
                    Active
                  </span>
                )}
              </div>

              {vehicle.nickname && (
                <div className="flex items-center gap-1 mb-2">
                  <Heart className="h-3 w-3 text-pink-400" />
                  <span className="text-sm text-pink-400 font-medium">{vehicle.nickname}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-zinc-400">
                {vehicle.engine && <span>Engine: {vehicle.engine}</span>}
                {vehicle.mileage && <span>Mileage: {vehicle.mileage.toLocaleString()} mi</span>}
                {vehicle.trim && <span>Trim: {vehicle.trim}</span>}
              </div>

              {vehicle.notes && (
                <p className="text-sm text-zinc-500 mt-2 line-clamp-2">{vehicle.notes}</p>
              )}
            </div>
          </div>

          <div className="flex gap-1 ml-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              className="p-2"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="p-2 text-red-400 hover:text-red-300"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

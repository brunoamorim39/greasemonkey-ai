'use client'

import { useState, useEffect } from 'react'
import { Car, Plus, Edit3, Trash2, Save, X, AlertCircle, ArrowUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

import { cn } from '@/lib/utils'
import { getTierDisplayName } from '@/lib/utils/tier'
import type { Database } from '@/lib/supabase'
import { InactiveVehicleManager } from './InactiveVehicleManager'
import { VehicleCard } from './VehicleCard'
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

interface InactiveVehicle extends Vehicle {
  is_active?: boolean
  deactivated_at?: string
  deactivation_reason?: string
  last_used_at?: string
}

interface VehicleManagerProps {
  vehicles: Vehicle[]
  inactiveVehicles?: any[]
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

// Edit Vehicle Card Component
function EditVehicleCard({
  vehicle,
  onSave,
  onCancel
}: {
  vehicle: Vehicle
  onSave: (updates: Partial<Vehicle>) => void
  onCancel: () => void
}) {
  const [editData, setEditData] = useState<Partial<Vehicle>>({
    make: vehicle.make,
    model: vehicle.model,
    year: vehicle.year,
    nickname: vehicle.nickname || '',
    trim: vehicle.trim || '',
    engine: vehicle.engine || '',
    mileage: vehicle.mileage,
    notes: vehicle.notes || ''
  })

  const handleSave = () => {
    onSave(editData)
  }

  return (
    <Card className="border-orange-500/30 bg-zinc-900/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <Edit3 className="h-5 w-5 text-orange-500" />
            Edit Vehicle
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="p-2 h-auto"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Year *</label>
              <Input
                type="number"
                value={editData.year || ''}
                onChange={(e) => setEditData({ ...editData, year: parseInt(e.target.value) || new Date().getFullYear() })}
                min="1900"
                max={new Date().getFullYear() + 2}
                required
                className="bg-zinc-800/50 border-zinc-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Make *</label>
              <Input
                value={editData.make || ''}
                onChange={(e) => setEditData({ ...editData, make: e.target.value })}
                required
                className="bg-zinc-800/50 border-zinc-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Model *</label>
              <Input
                value={editData.model || ''}
                onChange={(e) => setEditData({ ...editData, model: e.target.value })}
                required
                className="bg-zinc-800/50 border-zinc-700"
              />
            </div>
          </div>

          {/* Additional Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Nickname</label>
              <Input
                value={editData.nickname || ''}
                onChange={(e) => setEditData({ ...editData, nickname: e.target.value })}
                className="bg-zinc-800/50 border-zinc-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Trim Level</label>
              <Input
                value={editData.trim || ''}
                onChange={(e) => setEditData({ ...editData, trim: e.target.value })}
                className="bg-zinc-800/50 border-zinc-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Engine</label>
              <Input
                value={editData.engine || ''}
                onChange={(e) => setEditData({ ...editData, engine: e.target.value })}
                className="bg-zinc-800/50 border-zinc-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Current Mileage</label>
              <Input
                type="number"
                value={editData.mileage || ''}
                onChange={(e) => setEditData({ ...editData, mileage: parseInt(e.target.value) || undefined })}
                className="bg-zinc-800/50 border-zinc-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Notes</label>
            <textarea
              value={editData.notes || ''}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditData({ ...editData, notes: e.target.value })}
              className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 min-h-[80px]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
              disabled={!editData.make || !editData.model || !editData.year}
            >
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function VehicleManager({
  vehicles,
  inactiveVehicles = [],
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
    year: new Date().getFullYear(),
    make: '',
    model: '',
    nickname: '',
    trim: '',
    engine: '',
    notes: '',
    mileage: undefined
  })

  const tier = userStats?.tier || 'free'
  const maxVehicles = userStats?.usage?.limits?.maxVehicles
  const currentVehicles = vehicles.length
  const isAtVehicleLimit = maxVehicles !== undefined && maxVehicles !== null && currentVehicles >= maxVehicles

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newVehicle.make || !newVehicle.model || !newVehicle.year) {
      return
    }

    try {
      await onCreateVehicle(newVehicle as Omit<Vehicle, 'id'>)
      setNewVehicle({
        year: new Date().getFullYear(),
        make: '',
        model: '',
        nickname: '',
        trim: '',
        engine: '',
        notes: '',
        mileage: undefined
      })
      setIsAdding(false)
    } catch (error) {
      console.error('Error creating vehicle:', error)
    }
  }

  const handleUpdateVehicle = async (vehicleId: string, updates: Partial<Vehicle>) => {
    try {
      await onUpdateVehicle(vehicleId, updates)
      setEditingVehicle(null)
    } catch (error) {
      console.error('Error updating vehicle:', error)
    }
  }

  const handleDeleteVehicle = async (vehicleId: string) => {
    if (window.confirm('Are you sure you want to delete this vehicle?')) {
      try {
        await onDeleteVehicle(vehicleId)
      } catch (error) {
        console.error('Error deleting vehicle:', error)
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center">
              <Car className="h-5 w-5 text-white" />
            </div>
            Your Garage
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-zinc-400 text-sm">
              {currentVehicles}{maxVehicles !== undefined && maxVehicles !== null ? `/${maxVehicles}` : ''} vehicles
            </span>
            <span className="text-zinc-600">•</span>
            <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded">
              {getTierDisplayName(tier)}
            </span>
          </div>
        </div>

        {/* Add Vehicle Button */}
        {!isAtVehicleLimit && (
          <Button
            onClick={() => setIsAdding(true)}
            size="sm"
            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Vehicle
          </Button>
        )}
      </div>

      {/* Vehicle Limit Alert */}
      {isAtVehicleLimit && (
        <Card className="border-orange-500/30 bg-orange-500/10">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-orange-400 font-medium mb-1">Vehicle Limit Reached</h3>
                <p className="text-sm text-zinc-400 mb-3">
                  You've reached the maximum of {maxVehicles} vehicles for the {getTierDisplayName(tier)}.
                  Upgrade to add more vehicles to your garage.
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
      )}

      {/* Vehicle List */}
      {vehicles.length > 0 ? (
        <div className="space-y-3">
          {vehicles.map((vehicle) =>
            editingVehicle === vehicle.id ? (
              <EditVehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                onSave={(updates) => handleUpdateVehicle(vehicle.id, updates)}
                onCancel={() => setEditingVehicle(null)}
              />
            ) : (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                status="active"
                isSelected={selectedVehicle === vehicle.id}
                onClick={() => onVehicleSelect?.(vehicle.id)}
                onEdit={() => setEditingVehicle(vehicle.id)}
                onDelete={() => handleDeleteVehicle(vehicle.id)}
              />
            )
          )}
        </div>
      ) : (
        <Card className="border-zinc-800/50">
          <CardContent className="py-12 text-center">
            <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Car className="h-10 w-10 text-zinc-600" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No vehicles yet</h3>
            <p className="text-zinc-400 mb-6 max-w-sm mx-auto">
              Add your first vehicle to get personalized automotive assistance and maintenance tracking.
            </p>
            {!isAtVehicleLimit && (
              <Button
                onClick={() => setIsAdding(true)}
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Vehicle
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Inactive Vehicles */}
      {inactiveVehicles.length > 0 && (
        <InactiveVehicleManager
          inactiveVehicles={inactiveVehicles}
          currentTier={tier}
        />
      )}

      {/* Add Vehicle Form */}
      {isAdding && (
        <Card className="border-orange-500/30 bg-zinc-900/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3">
                <Plus className="h-5 w-5 text-orange-500" />
                Add New Vehicle
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAdding(false)}
                className="p-2 h-auto"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateVehicle} className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Year *</label>
                  <Input
                    type="number"
                    placeholder="2024"
                    value={newVehicle.year || ''}
                    onChange={(e) => setNewVehicle({ ...newVehicle, year: parseInt(e.target.value) || new Date().getFullYear() })}
                    min="1900"
                    max={new Date().getFullYear() + 2}
                    required
                    className="bg-zinc-800/50 border-zinc-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Make *</label>
                  <Input
                    placeholder="Toyota"
                    value={newVehicle.make || ''}
                    onChange={(e) => setNewVehicle({ ...newVehicle, make: e.target.value })}
                    required
                    className="bg-zinc-800/50 border-zinc-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Model *</label>
                  <Input
                    placeholder="Camry"
                    value={newVehicle.model || ''}
                    onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                    required
                    className="bg-zinc-800/50 border-zinc-700"
                  />
                </div>
              </div>

              {/* Additional Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Nickname</label>
                  <Input
                    placeholder="My Daily Driver"
                    value={newVehicle.nickname || ''}
                    onChange={(e) => setNewVehicle({ ...newVehicle, nickname: e.target.value })}
                    className="bg-zinc-800/50 border-zinc-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Trim Level</label>
                  <Input
                    placeholder="XLE, Sport, etc."
                    value={newVehicle.trim || ''}
                    onChange={(e) => setNewVehicle({ ...newVehicle, trim: e.target.value })}
                    className="bg-zinc-800/50 border-zinc-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Engine</label>
                  <Input
                    placeholder="2.4L I4, V6, etc."
                    value={newVehicle.engine || ''}
                    onChange={(e) => setNewVehicle({ ...newVehicle, engine: e.target.value })}
                    className="bg-zinc-800/50 border-zinc-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Current Mileage</label>
                  <Input
                    type="number"
                    placeholder="75000"
                    value={newVehicle.mileage || ''}
                    onChange={(e) => setNewVehicle({ ...newVehicle, mileage: parseInt(e.target.value) || undefined })}
                    className="bg-zinc-800/50 border-zinc-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Notes</label>
                <textarea
                  placeholder="Any additional details about your vehicle..."
                  value={newVehicle.notes || ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewVehicle({ ...newVehicle, notes: e.target.value })}
                  className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder:text-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 min-h-[80px]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAdding(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                  disabled={!newVehicle.make || !newVehicle.model || !newVehicle.year}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Add Vehicle
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

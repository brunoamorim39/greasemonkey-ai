import { useState, useRef, useEffect } from 'react'
import { Settings, Car, FileText, Menu, X, ChevronDown } from 'lucide-react'
import { Button } from './ui/Button'
import { UsageIndicator } from './UsageIndicator'
import { cn } from '@/lib/utils'

export type TabType = 'chat' | 'garage' | 'documents' | 'settings'

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

interface Vehicle {
  id: string
  displayName: string
  nickname?: string
  make: string
  model: string
  year: number
  trim?: string
}

interface MobileLayoutProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
  children: React.ReactNode
  showHeader?: boolean
  userStats?: UserStats | null
  vehicles?: Vehicle[]
  selectedVehicle?: string
  onVehicleSelect?: (vehicleId: string) => void
}

export function MobileLayout({
  activeTab,
  onTabChange,
  children,
  showHeader = true,
  userStats,
  vehicles = [],
  selectedVehicle = '',
  onVehicleSelect
}: MobileLayoutProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false)
  const vehicleDropdownRef = useRef<HTMLDivElement>(null)
  const vehicleOptionsRef = useRef<HTMLDivElement>(null)

  const tabs = [
    { id: 'chat' as const, label: 'Chat', icon: '💬' },
    { id: 'garage' as const, label: 'Garage', icon: '🚗' },
    { id: 'documents' as const, label: 'Docs', icon: '📄' },
    { id: 'settings' as const, label: 'Settings', icon: '⚙️' },
  ]

  const currentTab = tabs.find(tab => tab.id === activeTab)

  const getVehicleDisplayName = (vehicle: Vehicle) => {
    if (vehicle.nickname) {
      return vehicle.nickname
    }
    return `${vehicle.year} ${vehicle.make} ${vehicle.model}`
  }

  const selectedVehicleData = vehicles.find(v => v.id === selectedVehicle)

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        showVehicleDropdown &&
        vehicleDropdownRef.current &&
        vehicleOptionsRef.current &&
        !vehicleDropdownRef.current.contains(event.target as Node) &&
        !vehicleOptionsRef.current.contains(event.target as Node)
      ) {
        setShowVehicleDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showVehicleDropdown])

  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      {/* Minimal Header - only show on non-chat tabs */}
      {showHeader && activeTab !== 'chat' && (
        <div className="relative flex items-center px-4 py-3 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-sm">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 text-zinc-400 hover:text-white"
          >
            {showMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
              <span className="text-lg">🔧</span>
            </div>
            <span className="text-white font-semibold">GreaseMonkey</span>
          </div>

          <div className="ml-auto">
            {userStats && (
              <UsageIndicator userStats={userStats} />
            )}
          </div>
        </div>
      )}

      {/* Chat Header - with vehicle selector */}
      {showHeader && activeTab === 'chat' && (
        <div className="border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-sm">
          {/* Top row - Brand and controls */}
          <div className="relative flex items-center px-4 py-3">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-zinc-400 hover:text-white"
            >
              {showMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                <span className="text-lg">🔧</span>
              </div>
              <span className="text-white font-semibold">GreaseMonkey</span>
            </div>

            <div className="ml-auto">
              {userStats && (
                <UsageIndicator userStats={userStats} />
              )}
            </div>
          </div>

          {/* Vehicle selector section */}
          {vehicles.length > 0 && onVehicleSelect && (
            <div ref={vehicleDropdownRef} className="px-4 pb-3 relative">
              {/* Vehicle trigger button */}
              <button
                onClick={() => setShowVehicleDropdown(!showVehicleDropdown)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-zinc-900/30 hover:bg-zinc-800/50 rounded-xl border border-zinc-800/50 transition-all text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Car className="h-4 w-4 text-orange-400 flex-shrink-0" />
                  <div className="min-w-0">
                    {selectedVehicleData ? (
                      <>
                        <div className="text-white text-sm font-medium truncate">
                          {getVehicleDisplayName(selectedVehicleData)}
                        </div>
                        {selectedVehicleData.nickname && (
                          <div className="text-zinc-500 text-xs truncate">
                            {selectedVehicleData.year} {selectedVehicleData.make} {selectedVehicleData.model}
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
                    showVehicleDropdown && "rotate-180"
                  )}
                />
              </button>


            </div>
          )}
        </div>
      )}

      {/* Mobile Menu Overlay */}
      {showMenu && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowMenu(false)}
          />
          <div className="fixed top-0 left-0 h-full w-64 max-w-[80vw] bg-zinc-900 border-r border-zinc-800 z-50 p-4 mobile-menu">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-white font-semibold">Menu</h2>
              <button
                onClick={() => setShowMenu(false)}
                className="p-2 text-zinc-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    onTabChange(tab.id)
                    setShowMenu(false)
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all',
                    activeTab === tab.id
                      ? 'bg-orange-500 text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  )}
                >
                  <span className="text-lg">{tab.icon}</span>
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto mobile-scroll-container">
        {children}
      </div>

      {/* Vehicle Dropdown - Portal at top level to avoid z-index issues */}
      {showVehicleDropdown && (
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setShowVehicleDropdown(false)}
          />
          <div ref={vehicleOptionsRef} className="fixed top-[130px] left-4 right-4 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden z-[9999]">
            <div className="max-h-60 overflow-y-auto">
              {vehicles.map((vehicle) => (
                <button
                  key={vehicle.id}
                  onClick={() => {
                    onVehicleSelect?.(vehicle.id)
                    setShowVehicleDropdown(false)
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 hover:bg-zinc-800 transition-all text-left first:rounded-t-xl last:rounded-b-xl",
                    selectedVehicle === vehicle.id && "bg-orange-500/10"
                  )}
                >
                  <Car className="h-4 w-4 text-orange-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">
                      {getVehicleDisplayName(vehicle)}
                    </div>
                    {vehicle.nickname && (
                      <div className="text-zinc-500 text-xs truncate">
                        {vehicle.year} {vehicle.make} {vehicle.model}
                      </div>
                    )}
                  </div>
                  {selectedVehicle === vehicle.id && (
                    <div className="w-2 h-2 bg-orange-400 rounded-full flex-shrink-0"></div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

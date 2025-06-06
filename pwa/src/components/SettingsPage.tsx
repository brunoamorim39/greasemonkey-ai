'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Settings,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Moon,
  Sun,
  User,
  Shield,
  HelpCircle,
  MessageSquare,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  LogOut,
  Crown,
  Zap,
  ArrowUp,
  Check,
  ChevronRight,
  Mail,
  Star,
  Info,
  Ruler,
  AlertTriangle
} from 'lucide-react'
import { HelpCenter } from './HelpCenter'
import { FeedbackForm } from './FeedbackForm'
import { SupportForm } from './SupportForm'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Button } from './ui/Button'
import { Toggle } from './ui/Toggle'
import { apiPost, apiGet, apiPut, apiDelete } from '@/lib/api-client'
import { UnitPreferences } from '@/lib/supabase/types'
import type { User as SupabaseUser } from '@supabase/supabase-js'

// Helper for default unit preferences (subset for MVP)
const defaultUnitPreferences: Partial<UnitPreferences> = {
  torque_unit: 'pound_feet',
  pressure_unit: 'psi',
  length_unit: 'imperial',
  temperature_unit: 'fahrenheit',
  socket_unit: 'imperial'
};

interface AppSettings {
  voice_enabled: boolean;
  auto_play: boolean;
  playback_speed: number;
}

interface SettingsPageProps {
  userStats: any
  onClearHistory?: () => void
  onSignOut?: () => void
  onUpgrade?: () => void
  appSettings: AppSettings
  user: SupabaseUser
}

type SettingsView = 'main' | 'help-center' | 'feedback' | 'support'

export function SettingsPage({ userStats, onClearHistory, onSignOut, onUpgrade, appSettings, user }: SettingsPageProps) {
  const [currentView, setCurrentView] = useState<SettingsView>('main')
  const [settings, setSettings] = useState({
    playbackSpeed: appSettings.playback_speed,
    autoPlay: appSettings.auto_play,
    voiceEnabled: appSettings.voice_enabled,
  })
  const [isLoading, setIsLoading] = useState(false)

  // State for Unit Preferences
  const [unitPreferences, setUnitPreferences] = useState<Partial<UnitPreferences>>(defaultUnitPreferences)
  const [isLoadingUnitPreferences, setIsLoadingUnitPreferences] = useState(true)
  const [unitPrefError, setUnitPrefError] = useState<string | null>(null)

  // Sync settings when appSettings prop changes
  useEffect(() => {
    setSettings({
      playbackSpeed: appSettings.playback_speed,
      autoPlay: appSettings.auto_play,
      voiceEnabled: appSettings.voice_enabled,
    });
  }, [appSettings]);

  useEffect(() => {
    // Load general settings from localStorage - user-specific
    const savedSettings = localStorage.getItem(`greasemonkey-settings-${user.id}`)
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        setSettings(prev => ({ ...prev, ...parsed }))
      } catch (e) {
        console.error('Failed to parse saved settings:', e)
      }
    }

    // Load unit preferences from localStorage (initial fast load) - user-specific
    const savedUnitPrefs = localStorage.getItem(`greasemonkey-unit-preferences-${user.id}`);
    if (savedUnitPrefs) {
      try {
        setUnitPreferences(JSON.parse(savedUnitPrefs));
      } catch (e) {
        console.error('Failed to parse saved unit preferences:', e);
      }
    }

    // Fetch unit preferences from API
    const fetchUnitPreferences = async () => {
      setIsLoadingUnitPreferences(true);
      setUnitPrefError(null);
      try {
        const response = await apiGet('/api/user/preferences');
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: response.statusText }));
          throw new Error(errorData.message || `HTTP error ${response.status}`);
        }
        const prefs = await response.json() as Partial<UnitPreferences>; // Expect Partial in case some settings are null

        // Merge fetched prefs with local general settings state and unit defaults
        // API returns snake_case, but local settings use camelCase for consistency with existing localStorage
        setSettings(currentLocalSettings => ({
          ...currentLocalSettings,
          autoPlay: prefs.auto_play !== null && prefs.auto_play !== undefined ? prefs.auto_play : currentLocalSettings.autoPlay,
          voiceEnabled: prefs.voice_enabled !== null && prefs.voice_enabled !== undefined ? prefs.voice_enabled : currentLocalSettings.voiceEnabled,
          playbackSpeed: prefs.playback_speed !== null && prefs.playback_speed !== undefined ? prefs.playback_speed : currentLocalSettings.playbackSpeed,
        }));
        setUnitPreferences(currentUnitPrefs => ({ ...defaultUnitPreferences, ...currentUnitPrefs, ...prefs }));

      } catch (error: any) {
        console.error('Failed to fetch user preferences:', error);
        setUnitPrefError(error.message || 'Could not load unit preferences.');
      } finally {
        setIsLoadingUnitPreferences(false);
      }
    };
    fetchUnitPreferences();

  }, [])

  const saveSettings = async (newSettings: Partial<typeof settings>) => { // Accept partial for targeted updates
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    localStorage.setItem(`greasemonkey-settings-${user.id}`, JSON.stringify(updatedSettings));

    // Dispatch custom event to notify other components in the same window
    window.dispatchEvent(new CustomEvent('greasemonkey-settings-changed', {
      detail: updatedSettings
    }));

    // Prepare payload for API - ensure keys match UnitPreferences (snake_case)
    const apiPayload: Partial<UnitPreferences> = {};
    if (newSettings.autoPlay !== undefined) apiPayload.auto_play = newSettings.autoPlay;
    if (newSettings.voiceEnabled !== undefined) apiPayload.voice_enabled = newSettings.voiceEnabled;
    if (newSettings.playbackSpeed !== undefined) apiPayload.playback_speed = newSettings.playbackSpeed;

    if (Object.keys(apiPayload).length > 0) {
      try {
        await apiPut('/api/user/preferences', apiPayload);
      } catch (error) {
        console.error('Failed to save general settings to API:', error);
        // Optionally revert UI and localStorage or show an error toast
        setUnitPrefError('Failed to save some settings. Please try again.');
      }
    }
  };

  const handleUnitPreferenceChange = useCallback(async (key: keyof UnitPreferences, value: string | number | boolean) => {
    const newUnitPrefs = { ...unitPreferences, [key]: value };
    setUnitPreferences(newUnitPrefs);
    localStorage.setItem(`greasemonkey-unit-preferences-${user.id}`, JSON.stringify(newUnitPrefs));

    try {
      await apiPut('/api/user/preferences', { [key]: value });
      setUnitPrefError(null); // Clear previous errors on success
    } catch (error) {
      console.error('Failed to save unit preference to API:', error);
      setUnitPrefError(`Failed to save ${String(key).replace('_', ' ')}. Please try again.`);
    }
  }, [unitPreferences, settings]); // Added settings to dependencies if saveSettings might interact

  const handlePlaybackSpeedChange = (speed: number) => {
    saveSettings({ playbackSpeed: speed })
  }

  const handleClearConversationHistory = async () => {
    const confirmed = confirm(
      'This will permanently delete all your saved questions and responses. This action cannot be undone.\n\nAre you sure you want to continue?'
    )

    if (confirmed) {
      setIsLoading(true)
      try {
        // Clear from server
        const response = await apiPost('/api/user/clear-history')
        if (!response.ok) {
          // Get detailed error message from response
          let errorMessage = 'Failed to clear server history'
          try {
            const errorData = await response.json()
            errorMessage = errorData.error || errorMessage
          } catch (e) {
            // If can't parse JSON, use status text
            errorMessage = `${errorMessage}: ${response.status} ${response.statusText}`
          }
          throw new Error(errorMessage)
        }

        // Also clear local storage
        if (onClearHistory) {
          await onClearHistory()
        }

        alert('Conversation history cleared successfully')
      } catch (error) {
        console.error('Clear history error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
        alert(`Failed to clear conversation history: ${errorMessage}`)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleExportData = async () => {
    try {
      setIsLoading(true)

      // Call the comprehensive export API
      const response = await apiGet('/api/user/export')
      if (!response.ok) {
        throw new Error('Failed to export data')
      }

      const exportData = await response.json()
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `greasemonkey-data-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export error:', error)
      alert('Failed to export data. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendFeedback = () => {
    setCurrentView('feedback')
  }

  const handleContactSupport = () => {
    setCurrentView('support')
  }

  const getTierDisplayName = (tier: string) => {
    switch (tier) {
      case 'free': return 'Free'
      case 'pro': return 'Pro'
      case 'premium': return 'Premium'
      default: return 'Free'
    }
  }

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'premium': return <Crown className="h-4 w-4 text-yellow-400" />
      case 'pro': return <Zap className="h-4 w-4 text-blue-400" />
      default: return <User className="h-4 w-4 text-zinc-400" />
    }
  }

  const handleDeleteAccount = async () => {
    const confirmed = confirm(
      'This will permanently delete your entire account and all associated data. This action cannot be undone.\n\nType "DELETE MY ACCOUNT" below to confirm.'
    )

    if (confirmed) {
      const confirmationText = prompt('Type "DELETE MY ACCOUNT" to confirm:')

      if (confirmationText === 'DELETE MY ACCOUNT') {
        setIsLoading(true)
        try {
          const response = await apiPost('/api/user/delete-account', { confirmationText })

          if (!response.ok) {
            throw new Error('Failed to delete account')
          }

          alert('Account data deleted successfully. You will be signed out.')
          if (onSignOut) onSignOut()
        } catch (error) {
          console.error('Delete account error:', error)
          alert('Failed to delete account. Please contact support.')
        } finally {
          setIsLoading(false)
        }
      }
    }
  }

  const currentTier = userStats?.tier || 'free'
  const isFreeTier = currentTier === 'free'

  if (currentView === 'help-center') {
    return <HelpCenter onBack={() => setCurrentView('main')} />
  }

  if (currentView === 'feedback') {
    return <FeedbackForm onBack={() => setCurrentView('main')} />
  }

  if (currentView === 'support') {
    return <SupportForm onBack={() => setCurrentView('main')} />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-gray-500 to-gray-600 flex items-center justify-center">
            <Settings className="h-5 w-5 text-white" />
          </div>
          Settings
        </h1>
        <p className="text-zinc-400 mt-1">Customize your GreaseMonkey experience</p>
      </div>

      {/* Account & Billing */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <User className="h-5 w-5 text-gray-500" />
            Account & Billing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Plan */}
          <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-lg">
            <div className="flex items-center gap-3">
              {getTierIcon(currentTier)}
              <div>
                <p className="font-medium text-white">{getTierDisplayName(currentTier)} Plan</p>
                <p className="text-sm text-zinc-400">
                  {userStats?.usage?.monthly?.ask_count || 0} questions this month
                </p>
              </div>
            </div>
            {isFreeTier && (
              <Button
                onClick={onUpgrade}
                size="sm"
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
              >
                <ArrowUp className="h-4 w-4 mr-2" />
                Upgrade
              </Button>
            )}
          </div>

          {/* Free Tier Upgrade Prompt */}
          {isFreeTier && (
            <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Crown className="h-5 w-5 text-orange-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-orange-400 font-medium mb-1">Unlock Premium Features</h3>
                  <p className="text-sm text-zinc-400 mb-3">
                    Get unlimited questions, voice responses, document uploads, and priority support.
                  </p>
                  <Button
                    onClick={onUpgrade}
                    size="sm"
                    className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    View Plans
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Account Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {onUpgrade && !isFreeTier && (
              <Button
                variant="outline"
                onClick={onUpgrade}
                className="justify-start h-auto p-4"
              >
                <div className="flex items-center gap-3">
                  <Crown className="h-4 w-4 text-orange-400" />
                  <div className="text-left">
                    <p className="font-medium">Manage Plan</p>
                    <p className="text-sm text-zinc-400">Change or cancel subscription</p>
                  </div>
                </div>
              </Button>
            )}
            {onSignOut && (
              <Button
                variant="outline"
                onClick={onSignOut}
                className="justify-start h-auto p-4 hover:bg-red-500/10 hover:border-red-500/50"
              >
                <div className="flex items-center gap-3">
                  <LogOut className="h-4 w-4 text-red-400" />
                  <div className="text-left">
                    <p className="font-medium">Sign Out</p>
                    <p className="text-sm text-zinc-400">Log out of your account</p>
                  </div>
                </div>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Audio & Voice */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Volume2 className="h-5 w-5 text-orange-500" />
            Audio & Voice
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Playback Speed */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-white font-medium">
                Playback Speed
              </label>
              <span className="text-sm text-zinc-400 bg-zinc-800 px-2 py-1 rounded">
                {settings.playbackSpeed}x
              </span>
            </div>
            <div className="space-y-3">
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.25"
                value={settings.playbackSpeed}
                onChange={(e) => handlePlaybackSpeedChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #f97316 0%, #ef4444 ${((settings.playbackSpeed - 0.5) / 1.5) * 100}%, #3f3f46 ${((settings.playbackSpeed - 0.5) / 1.5) * 100}%, #3f3f46 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-zinc-500">
                <span>0.5x</span>
                <span>1x</span>
                <span>1.5x</span>
                <span>2x</span>
              </div>
            </div>
          </div>

          {/* Audio Toggles */}
          <div className="space-y-1">
            <div className="flex items-center justify-between py-3 px-4 bg-zinc-800/50 rounded-xl">
              <div className="flex items-center gap-3">
                {settings.autoPlay ? (
                  <Volume2 className="h-5 w-5 text-orange-400" />
                ) : (
                  <VolumeX className="h-5 w-5 text-zinc-400" />
                )}
                <div>
                  <p className="font-medium text-white">Auto-play Responses</p>
                  <p className="text-sm text-zinc-400">Automatically play audio responses</p>
                </div>
              </div>
              <Toggle
                checked={settings.autoPlay}
                onCheckedChange={(checked: boolean) => saveSettings({ autoPlay: checked })}
              />
            </div>

            <div className="flex items-center justify-between py-3 px-4 bg-zinc-800/50 rounded-xl">
              <div className="flex items-center gap-3">
                {settings.voiceEnabled ? (
                  <Mic className="h-5 w-5 text-orange-400" />
                ) : (
                  <MicOff className="h-5 w-5 text-zinc-400" />
                )}
                <div>
                  <p className="font-medium text-white">Voice Input</p>
                  <p className="text-sm text-zinc-400">Enable microphone recording</p>
                </div>
              </div>
              <Toggle
                checked={settings.voiceEnabled}
                onCheckedChange={(checked: boolean) => saveSettings({ voiceEnabled: checked })}
              />
            </div>

            {/* REMOVE Notifications Toggle START */}
            {/* <div className="flex items-center justify-between py-3 px-4 bg-zinc-800/50 rounded-xl">
              <div className="flex items-center gap-3">
                {settings.notifications ? (
                  <Bell className="h-5 w-5 text-orange-400" />
                ) : (
                  <BellOff className="h-5 w-5 text-zinc-400" />
                )}
                <div>
                  <p className="font-medium text-white">Notifications</p>
                  <p className="text-sm text-zinc-400">Get notified about updates</p>
                </div>
              </div>
              <Toggle
                checked={settings.notifications}
                onCheckedChange={(checked: boolean) => saveSettings({ ...settings, notifications: checked })}
              />
            </div> */}
            {/* REMOVE Notifications Toggle END */}
          </div>
        </CardContent>
      </Card>

      {/* Unit Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Ruler className="h-5 w-5 text-blue-500" />
            Unit Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingUnitPreferences && <p className="text-zinc-400">Loading unit preferences...</p>}
          {unitPrefError && <p className="text-red-400">{unitPrefError}</p>}
          {!isLoadingUnitPreferences && !unitPrefError && (
            <>
              {/* Torque Unit */}
              <div>
                <label htmlFor="torque_unit" className="block text-sm font-medium text-white mb-1">
                  Torque
                </label>
                <select
                  id="torque_unit"
                  name="torque_unit"
                  value={unitPreferences.torque_unit || defaultUnitPreferences.torque_unit}
                  onChange={(e) => handleUnitPreferenceChange('torque_unit', e.target.value)}
                  className="block w-full rounded-md border-zinc-700 bg-zinc-800 py-2 px-3 text-white shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500 sm:text-sm"
                >
                  <option value="pound_feet">Pound Feet (lb-ft)</option>
                  <option value="newton_meters">Newton Meters (Nm)</option>
                </select>
              </div>

              {/* Pressure Unit */}
              <div>
                <label htmlFor="pressure_unit" className="block text-sm font-medium text-white mb-1">
                  Pressure
                </label>
                <select
                  id="pressure_unit"
                  name="pressure_unit"
                  value={unitPreferences.pressure_unit || defaultUnitPreferences.pressure_unit}
                  onChange={(e) => handleUnitPreferenceChange('pressure_unit', e.target.value)}
                  className="block w-full rounded-md border-zinc-700 bg-zinc-800 py-2 px-3 text-white shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500 sm:text-sm"
                >
                  <option value="psi">PSI (Pounds per square inch)</option>
                  <option value="bar">Bar</option>
                  <option value="kilopascals">Kilopascals (kPa)</option>
                </select>
              </div>

              {/* Length Unit */}
              <div>
                <label htmlFor="length_unit" className="block text-sm font-medium text-white mb-1">
                  Length (General)
                </label>
                <select
                  id="length_unit"
                  name="length_unit"
                  value={unitPreferences.length_unit || defaultUnitPreferences.length_unit}
                  onChange={(e) => handleUnitPreferenceChange('length_unit', e.target.value)}
                  className="block w-full rounded-md border-zinc-700 bg-zinc-800 py-2 px-3 text-white shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500 sm:text-sm"
                >
                  <option value="imperial">Imperial (inches, feet)</option>
                  <option value="metric">Metric (mm, cm, m)</option>
                </select>
              </div>

              {/* Temperature Unit */}
              <div>
                <label htmlFor="temperature_unit" className="block text-sm font-medium text-white mb-1">
                  Temperature
                </label>
                <select
                  id="temperature_unit"
                  name="temperature_unit"
                  value={unitPreferences.temperature_unit || defaultUnitPreferences.temperature_unit}
                  onChange={(e) => handleUnitPreferenceChange('temperature_unit', e.target.value)}
                  className="block w-full rounded-md border-zinc-700 bg-zinc-800 py-2 px-3 text-white shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500 sm:text-sm"
                >
                  <option value="fahrenheit">Fahrenheit (°F)</option>
                  <option value="celsius">Celsius (°C)</option>
                </select>
              </div>

              {/* Socket Unit */}
              <div>
                <label htmlFor="socket_unit" className="block text-sm font-medium text-white mb-1">
                  Socket Size System
                </label>
                <select
                  id="socket_unit"
                  name="socket_unit"
                  value={unitPreferences.socket_unit || defaultUnitPreferences.socket_unit}
                  onChange={(e) => handleUnitPreferenceChange('socket_unit', e.target.value)}
                  className="block w-full rounded-md border-zinc-700 bg-zinc-800 py-2 px-3 text-white shadow-sm focus:border-orange-500 focus:outline-none focus:ring-orange-500 sm:text-sm"
                >
                  <option value="imperial">Imperial (SAE)</option>
                  <option value="metric">Metric (mm)</option>
                </select>
              </div>

            </>
          )}
        </CardContent>
      </Card>

      {/* Data & Privacy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-green-500" />
            Data & Privacy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={handleExportData}
              disabled={isLoading}
              className="justify-start h-auto p-4"
            >
              <div className="flex items-center gap-3">
                <Download className="h-4 w-4 text-blue-400" />
                <div className="text-left">
                  <p className="font-medium">Export Data</p>
                  <p className="text-sm text-zinc-400">Download all your data</p>
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={handleClearConversationHistory}
              disabled={isLoading}
              className="justify-start h-auto p-4 hover:bg-red-500/10 hover:border-red-500/50"
            >
              <div className="flex items-center gap-3">
                <Trash2 className="h-4 w-4 text-red-400" />
                <div className="text-left">
                  <p className="font-medium">Clear History</p>
                  <p className="text-sm text-zinc-400">Delete all conversations</p>
                </div>
              </div>
            </Button>
          </div>

          {/* Account Deletion */}
          <div className="border-t border-zinc-700 pt-4">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-red-400 font-medium mb-1">Danger Zone</h3>
                  <p className="text-sm text-zinc-400 mb-3">
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </p>
                  <Button
                    variant="outline"
                    onClick={handleDeleteAccount}
                    disabled={isLoading}
                    className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Account
                  </Button>
                </div>
              </div>
            </div>
          </div>


        </CardContent>
      </Card>

      {/* Support & Help */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <HelpCircle className="h-5 w-5 text-purple-500" />
            Support & Help
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={handleSendFeedback}
              className="justify-start h-auto p-4"
            >
              <div className="flex items-center gap-3">
                <MessageSquare className="h-4 w-4 text-purple-400" />
                <div className="text-left">
                  <p className="font-medium">Send Feedback</p>
                  <p className="text-sm text-zinc-400">Report bugs or suggest features</p>
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={() => setCurrentView('help-center')}
              className="justify-start h-auto p-4"
            >
              <div className="flex items-center gap-3">
                <HelpCircle className="h-4 w-4 text-purple-400" />
                <div className="text-left">
                  <p className="font-medium">Help Center</p>
                  <p className="text-sm text-zinc-400">FAQs and documentation</p>
                </div>
              </div>
            </Button>
          </div>

          <Button
            variant="outline"
            onClick={handleContactSupport}
            className="w-full justify-start h-auto p-4"
          >
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-purple-400" />
              <div className="text-left">
                <p className="font-medium">Contact Support</p>
                <p className="text-sm text-zinc-400">Submit a support ticket</p>
              </div>
            </div>
          </Button>
        </CardContent>
      </Card>

      {/* App Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Info className="h-5 w-5 text-zinc-500" />
            About GreaseMonkey
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-white">🐒</span>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">GreaseMonkey AI</h3>
            <p className="text-zinc-400 mb-4">
              Your AI-powered automotive assistant
            </p>
            <div className="flex items-center justify-center gap-4 text-sm text-zinc-500">
              <span>Version 1.0.0</span>
              <span>•</span>
              <span>PWA</span>
            </div>
          </div>

          <div className="bg-zinc-900/50 rounded-lg p-4 text-center">
            <p className="text-sm text-zinc-400">
              Built with ❤️ for car enthusiasts everywhere
            </p>
            <div className="flex items-center justify-center gap-1 mt-2">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

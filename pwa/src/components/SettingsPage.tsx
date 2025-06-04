'use client'

import { useState, useEffect } from 'react'
import {
  Settings,
  Volume2,
  Mic,
  Bell,
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
  LogOut
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Button } from './ui/Button'
import { apiPost } from '@/lib/api-client'

interface SettingsPageProps {
  userStats: any
  onClearHistory?: () => void
  onSignOut?: () => void
  onUpgrade?: () => void
}

export function SettingsPage({ userStats, onClearHistory, onSignOut, onUpgrade }: SettingsPageProps) {
  const [settings, setSettings] = useState({
    playbackSpeed: 1.0,
    autoPlay: true,
    voiceEnabled: true,
    notifications: true,
    darkMode: true,
    highContrast: false,
    reducedAnimations: false
  })
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('greasemonkey-settings')
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        setSettings(prev => ({ ...prev, ...parsed }))
      } catch (e) {
        console.error('Failed to parse saved settings:', e)
      }
    }
  }, [])

  const saveSettings = (newSettings: typeof settings) => {
    setSettings(newSettings)
    localStorage.setItem('greasemonkey-settings', JSON.stringify(newSettings))
  }

  const handlePlaybackSpeedChange = (speed: number) => {
    saveSettings({ ...settings, playbackSpeed: speed })
  }

  const handleToggleSetting = (key: keyof typeof settings) => {
    saveSettings({ ...settings, [key]: !settings[key] })
  }

  const handleClearConversationHistory = async () => {
    const confirmed = confirm(
      'This will permanently delete all your saved questions and responses. This action cannot be undone.\n\nAre you sure you want to continue?'
    )

    if (confirmed && onClearHistory) {
      setIsLoading(true)
      try {
        await onClearHistory()
        alert('Conversation history cleared successfully')
      } catch (error) {
        alert('Failed to clear conversation history')
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleExportData = async () => {
    try {
      setIsLoading(true)
      // This would typically call an API to export user data
      const data = {
        settings,
        userStats,
        exportDate: new Date().toISOString()
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `greasemonkey-data-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      alert('Failed to export data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendFeedback = () => {
    const subject = encodeURIComponent('GreaseMonkey AI Feedback')
    const body = encodeURIComponent(`Hi GreaseMonkey team,

I'd like to share some feedback about the app:

[Please describe your feedback here]

---
App Version: PWA v1.0
User Tier: ${userStats?.tier || 'Unknown'}
Date: ${new Date().toLocaleDateString()}`)

    window.open(`mailto:support@greasemonkey.ai?subject=${subject}&body=${body}`)
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* User Profile Section */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <User className="h-6 w-6 text-orange-500" />
            Profile & Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Account Type</p>
              <p className="text-sm text-zinc-400">
                {userStats?.tier === 'free_tier' ? 'Free Plan' :
                 userStats?.tier === 'weekend_warrior' ? 'Weekend Warrior Plan' :
                 userStats?.tier === 'master_tech' ? 'Master Tech Plan' : 'Premium Plan'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-white font-medium">Usage This Month</p>
              <p className="text-sm text-zinc-400">
                {userStats?.usage?.monthly?.ask_count || 0} questions asked
              </p>
            </div>
          </div>

          {/* Upgrade Section for Free Users */}
          {userStats?.tier === 'free_tier' && onUpgrade && (
            <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-200 font-medium">Unlock Premium Features</p>
                  <p className="text-sm text-orange-200/80 mt-1">
                    Get unlimited questions, audio responses, and document uploads
                  </p>
                </div>
                <Button
                  variant="primary"
                  onClick={onUpgrade}
                  size="sm"
                  className="shrink-0 ml-4"
                >
                  Upgrade Plan
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {onUpgrade && (
              <Button
                variant="outline"
                onClick={onUpgrade}
                className="w-full"
              >
                Change Plan
              </Button>
            )}

            {onSignOut && (
              <Button
                variant="outline"
                onClick={onSignOut}
                icon={<LogOut className="h-4 w-4" />}
                className="w-full"
              >
                Sign Out
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Audio Settings */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Volume2 className="h-6 w-6 text-orange-500" />
            Audio Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="block text-white font-medium mb-3">
              Playback Speed: {settings.playbackSpeed}x
            </label>
            <div className="flex gap-2 flex-wrap">
              {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map(speed => (
                <Button
                  key={speed}
                  variant={settings.playbackSpeed === speed ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => handlePlaybackSpeedChange(speed)}
                >
                  {speed}x
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Auto-play responses</p>
              <p className="text-sm text-zinc-400">Automatically play audio responses</p>
            </div>
            <Button
              variant={settings.autoPlay ? 'primary' : 'outline'}
              size="sm"
              onClick={() => handleToggleSetting('autoPlay')}
            >
              {settings.autoPlay ? 'On' : 'Off'}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Voice input</p>
              <p className="text-sm text-zinc-400">Enable microphone recording</p>
            </div>
            <Button
              variant={settings.voiceEnabled ? 'primary' : 'outline'}
              size="sm"
              onClick={() => handleToggleSetting('voiceEnabled')}
            >
              {settings.voiceEnabled ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Accessibility Settings */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-orange-500" />
            Accessibility
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">High contrast mode</p>
              <p className="text-sm text-zinc-400">Improve text visibility</p>
            </div>
            <Button
              variant={settings.highContrast ? 'primary' : 'outline'}
              size="sm"
              onClick={() => handleToggleSetting('highContrast')}
            >
              {settings.highContrast ? 'On' : 'Off'}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Reduced animations</p>
              <p className="text-sm text-zinc-400">Minimize motion effects</p>
            </div>
            <Button
              variant={settings.reducedAnimations ? 'primary' : 'outline'}
              size="sm"
              onClick={() => handleToggleSetting('reducedAnimations')}
            >
              {settings.reducedAnimations ? 'On' : 'Off'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <RefreshCw className="h-6 w-6 text-orange-500" />
            Data Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              variant="outline"
              onClick={handleExportData}
              loading={isLoading}
              icon={<Download className="h-4 w-4" />}
            >
              Export My Data
            </Button>

            <Button
              variant="danger"
              onClick={handleClearConversationHistory}
              loading={isLoading}
              icon={<Trash2 className="h-4 w-4" />}
            >
              Clear Chat History
            </Button>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-200 font-medium">Privacy Note</p>
                <p className="text-sm text-amber-200/80 mt-1">
                  Your conversation history is stored locally and on our secure servers.
                  Clearing history will remove data from both locations permanently.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Support & Feedback */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <HelpCircle className="h-6 w-6 text-orange-500" />
            Support & Feedback
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              variant="outline"
              onClick={handleSendFeedback}
              icon={<MessageSquare className="h-4 w-4" />}
            >
              Send Feedback
            </Button>

            <Button
              variant="outline"
              onClick={() => window.open('https://greasemonkey.ai/help', '_blank')}
              icon={<HelpCircle className="h-4 w-4" />}
            >
              Help Center
            </Button>
          </div>

          <div className="text-center pt-4 border-t border-zinc-700">
            <p className="text-sm text-zinc-400">
              GreaseMonkey AI PWA v1.0 • Built with ❤️ for car enthusiasts
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

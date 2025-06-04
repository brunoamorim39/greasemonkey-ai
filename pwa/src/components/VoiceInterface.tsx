'use client'

import { useState, useEffect } from 'react'
import { Mic, MicOff, Volume2, Pause, Play, StopCircle, Trash2 } from 'lucide-react'
import { Button } from './ui/Button'
import { Card, CardContent } from './ui/Card'
import { cn } from '@/lib/utils'

interface VoiceInterfaceProps {
  isRecording: boolean
  isProcessing: boolean
  audioUrl: string | null
  isPlaying?: boolean
  onStartRecording: () => void
  onStopRecording: () => void
  onPlayAudio: () => void
  onDiscardRecording?: () => void
  showTips?: boolean
  className?: string
}

export function VoiceInterface({
  isRecording,
  isProcessing,
  audioUrl,
  isPlaying = false,
  onStartRecording,
  onStopRecording,
  onPlayAudio,
  onDiscardRecording,
  showTips = false,
  className
}: VoiceInterfaceProps) {
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt'>('prompt')
  const [pulseIntensity, setPulseIntensity] = useState(0)

  useEffect(() => {
    // Check microphone permissions
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'microphone' as PermissionName })
        .then(result => {
          setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt')
          result.onchange = () => {
            setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt')
          }
        })
        .catch(() => {
          // Fallback for browsers that don't support permissions API
          setPermissionStatus('prompt')
        })
    }
  }, [])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isRecording) {
      interval = setInterval(() => {
        setPulseIntensity(prev => (prev + 1) % 3)
      }, 800)
    } else {
      setPulseIntensity(0)
    }
    return () => interval && clearInterval(interval)
  }, [isRecording])

  const handleMicClick = () => {
    if (isRecording) {
      onStopRecording()
    } else {
      onStartRecording()
    }
  }

  const getMicButtonContent = () => {
    if (isProcessing) {
      return (
        <div className="relative">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-white/30" />
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-white border-t-transparent absolute inset-0"
               style={{ animationDirection: 'reverse', animationDuration: '1s' }} />
        </div>
      )
    }

    if (permissionStatus === 'denied') {
      return <MicOff className="h-10 w-10 text-white" />
    }

    return isRecording ? (
      <StopCircle className="h-10 w-10 text-white" />
    ) : (
      <Mic className="h-10 w-10 text-white" />
    )
  }

  const getMicButtonColor = () => {
    if (isProcessing) return 'bg-gradient-to-r from-blue-500 to-blue-600'
    if (permissionStatus === 'denied') return 'bg-gradient-to-r from-gray-500 to-gray-600'
    if (isRecording) return 'bg-gradient-to-r from-red-500 to-red-600'
    return 'bg-gradient-to-r from-orange-500 to-red-500'
  }

  const getMicButtonShadow = () => {
    if (isRecording) {
      const intensityMap = ['shadow-lg shadow-red-500/30', 'shadow-xl shadow-red-500/50', 'shadow-2xl shadow-red-500/70']
      return intensityMap[pulseIntensity] || 'shadow-lg shadow-red-500/30'
    }
    if (isProcessing) return 'shadow-lg shadow-blue-500/50'
    return 'shadow-lg shadow-orange-500/50'
  }

  return (
    <div className={cn("flex flex-col items-center space-y-6", className)}>
      {/* Main Voice Control */}
      <div className="relative flex items-center justify-center">
        {/* Discard button - only show when recording */}
        {isRecording && onDiscardRecording && (
          <Button
            variant="ghost"
            size="lg"
            onClick={onDiscardRecording}
            className="absolute -left-20 p-4 rounded-full bg-gray-600/80 hover:bg-gray-500/80 transition-all duration-200"
          >
            <Trash2 className="h-6 w-6 text-white" />
          </Button>
        )}

        {/* Primary microphone button */}
        <Button
          onClick={handleMicClick}
          disabled={isProcessing || permissionStatus === 'denied'}
          className={cn(
            "w-24 h-24 rounded-full transition-all duration-300 hover:scale-105 active:scale-95",
            getMicButtonColor(),
            getMicButtonShadow(),
            isRecording && "animate-pulse"
          )}
        >
          {getMicButtonContent()}
        </Button>
      </div>

      {/* Status Text */}
      <div className="text-center space-y-2">
        {permissionStatus === 'denied' ? (
          <div className="space-y-1">
            <p className="text-red-400 font-medium">Microphone access denied</p>
            <p className="text-sm text-zinc-400">Please enable microphone permissions to use voice features</p>
          </div>
        ) : isProcessing ? (
          <div className="space-y-1">
            <p className="text-blue-400 font-medium animate-pulse">Processing your question...</p>
            <p className="text-sm text-zinc-400">This may take a moment</p>
          </div>
        ) : isRecording ? (
          <div className="space-y-1">
            <p className="text-red-400 font-medium">Listening...</p>
            <p className="text-sm text-zinc-400">Speak your automotive question</p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-orange-400 font-medium">Tap to ask a question</p>
            <p className="text-sm text-zinc-400">Voice-first automotive assistance</p>
          </div>
        )}
      </div>

      {/* Audio Playback Controls */}
      {audioUrl && (
        <Card variant="glass" className="w-full max-w-md">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-green-500 to-green-600 p-2 rounded-lg">
                <Volume2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-white font-medium">Audio Response</p>
                <p className="text-sm text-zinc-400">Tap to play answer</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onPlayAudio}
              className="shrink-0"
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Voice Tips - only show when showTips is true */}
      {showTips && (
        <Card variant="glass" className="w-full max-w-md">
          <CardContent className="py-4">
            <div className="text-center space-y-2">
              <div className="text-lg">🎤</div>
              <p className="text-sm text-zinc-300 font-medium">Voice Tips</p>
              <ul className="text-xs text-zinc-400 space-y-1">
                <li>• Speak clearly and naturally</li>
                <li>• Include your vehicle make/model</li>
                <li>• Ask specific repair questions</li>
                <li>• Say "stop" to cancel recording</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

'use client'

import { useState, useRef, useEffect } from 'react'
import { apiGet, apiPost, apiDelete, apiPostFormData, apiPut } from '@/lib/api-client'
import ClientOnly from '@/components/ClientOnly'
import { AuthGuard } from '@/components/AuthGuard'
import { Navigation, TabType } from '@/components/Navigation'
import { VoiceInterface } from '@/components/VoiceInterface'
import { VehicleManager } from '@/components/VehicleManager'
import { DocumentManager } from '@/components/DocumentManager'
import { SettingsPage } from '@/components/SettingsPage'
import { PricingPlans } from '@/components/PricingPlans'
import { UsageStatus } from '@/components/UsageStatus'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Mic,
  MessageSquare,
  Keyboard,
  Volume2,
  Sparkles,
  Car,
  ChevronDown,
  Heart
} from 'lucide-react'

const DEFAULT_USER_ID = 'demo-user'

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

interface Document {
  id: string
  filename: string
  type: string
  status: string
  sizeMB: string
  createdAt: string
  category?: string
  description?: string
}

interface UserStats {
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
    documents: Document[]
  }
}

interface ConversationMessage {
  id: string
  question: string
  answer: string
  audioUrl?: string
  timestamp: Date
  vehicleId?: string
  vehicleContext?: string
}

function MainApp() {
  // Voice and audio state
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  // Current conversation
  const [currentQuestion, setCurrentQuestion] = useState('')
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null)

  // Conversation history
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([])

  // App state
  const [selectedVehicle, setSelectedVehicle] = useState<string>('')
  const [activeTab, setActiveTab] = useState<TabType>('chat')
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [showTextInput, setShowTextInput] = useState(false)
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false)
  const [showPricing, setShowPricing] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    loadUserStats()
    loadConversationHistory()
  }, [])

  useEffect(() => {
    // Save conversation history when it changes
    saveConversationHistory(conversationHistory)
  }, [conversationHistory])

  const loadUserStats = async () => {
    try {
      const response = await apiGet('/api/user/stats')
      if (response.ok) {
        const stats = await response.json()
        setUserStats(stats)

        // Auto-select the first vehicle if none selected
        if (stats.vehicles.vehicles.length > 0 && !selectedVehicle) {
          setSelectedVehicle(stats.vehicles.vehicles[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to load user stats:', error)
    }
  }

  const loadConversationHistory = () => {
    try {
      const saved = localStorage.getItem('greasemonkey-conversation-history')
      if (saved) {
        const parsed = JSON.parse(saved)
        setConversationHistory(parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })))
      }
    } catch (error) {
      console.error('Failed to load conversation history:', error)
    }
  }

  const saveConversationHistory = (messages: ConversationMessage[]) => {
    try {
      localStorage.setItem('greasemonkey-conversation-history', JSON.stringify(messages))
    } catch (error) {
      console.error('Failed to save conversation history:', error)
    }
  }

  const addToConversationHistory = (question: string, answer: string, audioUrl?: string) => {
    const newMessage: ConversationMessage = {
      id: Date.now().toString(),
      question,
      answer,
      audioUrl,
      timestamp: new Date(),
      vehicleId: selectedVehicle || undefined,
      vehicleContext: selectedVehicle ? getSelectedVehicleDisplayName() : undefined
    }

    const updatedHistory = [newMessage, ...conversationHistory].slice(0, 50) // Keep last 50 messages
    setConversationHistory(updatedHistory)
  }

  const clearConversationHistory = async () => {
    setConversationHistory([])
    localStorage.removeItem('greasemonkey-conversation-history')
    // Also clear current conversation
    setCurrentQuestion('')
    setCurrentAnswer('')
    setCurrentAudioUrl(null)
  }

  const getSelectedVehicle = () => {
    return userStats?.vehicles.vehicles.find(v => v.id === selectedVehicle)
  }

  const getSelectedVehicleDisplayName = () => {
    const vehicle = getSelectedVehicle()
    if (!vehicle) return ''

    const displayName = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ''}`

    if (vehicle.nickname) {
      return `${vehicle.nickname} (${displayName})`
    }
    return displayName
  }

  // Filter conversation history by selected vehicle
  const getVehicleConversationHistory = () => {
    if (!selectedVehicle) return []
    return conversationHistory.filter(msg => msg.vehicleId === selectedVehicle)
  }

  const handleSelectPlan = (planId: string, billingType: 'monthly' | 'yearly') => {
    // This would integrate with Stripe or your payment processor
    console.log(`User selected plan: ${planId} (${billingType})`)
    // For now, just close the pricing modal
    setShowPricing(false)
  }

  const handleSignOut = async () => {
    try {
      // Clear local storage first
      localStorage.removeItem('greasemonkey-user')
      localStorage.removeItem('greasemonkey-conversation-history')
      localStorage.removeItem('greasemonkey-settings')

      // Actually sign out from Supabase
      const { signOut } = await import('@/lib/supabase')
      await signOut()

      // Force reload to trigger AuthGuard re-evaluation
      window.location.href = window.location.href
    } catch (error) {
      console.error('Sign out error:', error)
      // Even if sign out fails, force reload to reset state
      window.location.href = window.location.href
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      const chunks: BlobPart[] = []

      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' })
        await transcribeAudio(audioBlob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Error starting recording:', error)
      alert('Could not access microphone. Please check permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const discardRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      // Don't process the audio
    }
  }

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      setIsProcessing(true)
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')
      formData.append('user_id', DEFAULT_USER_ID)

      const response = await apiPostFormData('/api/stt', formData)

      if (response.ok) {
        const data = await response.json()
        const questionText = data.text || ''
        setCurrentQuestion(questionText)
        await askQuestion(questionText)
      } else {
        console.error('Transcription failed')
        setCurrentAnswer('❌ Sorry, I couldn\'t understand your question. Please try again.')
      }
    } catch (error) {
      console.error('Error transcribing audio:', error)
      setCurrentAnswer('❌ Sorry, there was an error processing your voice. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  const askQuestion = async (questionText: string = currentQuestion) => {
    if (!questionText.trim()) return

    setIsProcessing(true)
    setCurrentAnswer('')
    setCurrentAudioUrl(null)

    try {
      const response = await apiPost('/api/ask', {
        question: questionText,
        vehicleId: selectedVehicle || undefined,
        includeDocuments: true,
      })

      const data = await response.json()

      if (data.error) {
        if (data.upgrade_required) {
          setCurrentAnswer(`❌ ${data.error}\n\n🚀 Upgrade your plan to continue asking questions and unlock premium features!`)
        } else {
          setCurrentAnswer(`❌ ${data.error}`)
        }
      } else {
        setCurrentAnswer(data.response)
        if (data.audioUrl) {
          setCurrentAudioUrl(data.audioUrl)
        }

        // Add to conversation history
        addToConversationHistory(questionText, data.response, data.audioUrl)
      }

      if (!data.error) {
        loadUserStats()
      }
    } catch (error) {
      console.error('Error:', error)
      setCurrentAnswer('❌ Sorry, there was an error processing your request.')
    } finally {
      setIsProcessing(false)
    }
  }

  const playAudio = () => {
    if (audioRef.current && currentAudioUrl) {
      setIsPlaying(true)
      audioRef.current.play()
    }
  }

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentQuestion.trim() || isProcessing) return
    await askQuestion()
  }

  // Vehicle management
  const createVehicle = async (vehicleData: Omit<Vehicle, 'id'>) => {
    try {
      const response = await apiPost('/api/vehicles', vehicleData)
      if (response.ok) {
        await loadUserStats()
      } else {
        const errorData = await response.text()
        console.error('Error creating vehicle:', errorData)

        // Check if it's a vehicle limit error
        if (response.status === 429 && errorData.includes('Vehicle limit reached')) {
          // Extract the tier info for better messaging
          const tier = userStats?.tier || 'current plan'
          const tierName = tier === 'free_tier' ? 'Free Tier' :
                          tier === 'weekend_warrior' ? 'Weekend Warrior' :
                          tier === 'master_tech' ? 'Master Tech' : tier

          alert(`Vehicle limit reached for ${tierName}. Please upgrade your plan to add more vehicles to your garage.`)
          return
        }

        throw new Error('Failed to create vehicle')
      }
    } catch (error) {
      console.error('Error creating vehicle:', error)
      throw error
    }
  }

  const updateVehicle = async (id: string, updates: Partial<Vehicle>) => {
    try {
      const response = await apiPut(`/api/vehicles/${id}`, updates)
      if (response.ok) {
        await loadUserStats()
      } else {
        throw new Error('Failed to update vehicle')
      }
    } catch (error) {
      console.error('Error updating vehicle:', error)
      throw error
    }
  }

  const deleteVehicle = async (vehicleId: string) => {
    try {
      const response = await apiDelete(`/api/vehicles/${vehicleId}`)
      if (response.ok) {
        if (selectedVehicle === vehicleId) {
          setSelectedVehicle('')
        }
        await loadUserStats()
      } else {
        throw new Error('Failed to delete vehicle')
      }
    } catch (error) {
      console.error('Error deleting vehicle:', error)
      throw error
    }
  }

  // Document management
  const uploadDocument = async (file: File, category: string, description?: string) => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', category)
      if (description) {
        formData.append('description', description)
      }

      const response = await apiPostFormData('/api/documents', formData)
      if (response.ok) {
        await loadUserStats()
      } else {
        const errorData = await response.json()

        // Check if it's a document limit error
        if (response.status === 429 && errorData.error && errorData.error.includes('limit')) {
          // Extract the tier info for better messaging
          const tier = userStats?.tier || 'current plan'
          const tierName = tier === 'free_tier' ? 'Free Tier' :
                          tier === 'weekend_warrior' ? 'Weekend Warrior' :
                          tier === 'master_tech' ? 'Master Tech' : tier

          alert(`Document limit reached for ${tierName}. Please upgrade your plan to upload more documents.`)
          return
        }

        throw new Error(errorData.error || 'Failed to upload document')
      }
    } catch (error) {
      console.error('Error uploading document:', error)
      throw error
    }
  }

  const deleteDocument = async (documentId: string) => {
    try {
      const response = await apiDelete(`/api/documents/${documentId}`)
      if (response.ok) {
        await loadUserStats()
      } else {
        throw new Error('Failed to delete document')
      }
    } catch (error) {
      console.error('Error deleting document:', error)
      throw error
    }
  }

  // Layout wrapper for all tabs
  const PageLayout = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen relative">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Card variant="glass" className="overflow-hidden">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-r from-orange-500 to-red-500 p-3 rounded-2xl shadow-glow animate-float">
                  <span className="text-2xl">🔧</span>
                </div>
                <div>
                  <CardTitle className="text-gradient">GreaseMonkey AI</CardTitle>
                  <p className="text-zinc-400 mt-1">Your voice-first automotive assistant</p>
                </div>
              </div>

              <ClientOnly fallback={<div className="h-10 w-48 skeleton" />}>
                <div className="relative">
                  <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
                </div>
              </ClientOnly>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {children}
          </CardContent>
        </Card>
      </div>

      {currentAudioUrl && (
        <audio
          ref={audioRef}
          src={currentAudioUrl}
          className="hidden"
          onEnded={() => setIsPlaying(false)}
          onPause={() => setIsPlaying(false)}
        />
      )}

      {/* Pricing Modal */}
      {showPricing && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-700 max-w-7xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Choose Your Plan</h2>
                <Button
                  variant="ghost"
                  onClick={() => setShowPricing(false)}
                  className="p-2"
                >
                  ✕
                </Button>
              </div>
              <PricingPlans
                currentPlan={userStats?.tier || 'free'}
                onSelectPlan={handleSelectPlan}
                showCurrentPlan={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // Chat Tab - Voice-First Interface
  if (activeTab === 'chat') {
    const vehicleHistory = getVehicleConversationHistory()
    const hasConversationHistory = vehicleHistory.length > 0 || currentAnswer

    return (
      <PageLayout>
        {/* Vehicle Selection */}
        {userStats && userStats.vehicles.count > 0 && (
          <Card variant="glass">
            <CardContent className="py-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <span className="text-sm text-zinc-400 shrink-0">Currently asking about:</span>
                <div className="relative flex-1">
                  <button
                    onClick={() => setShowVehicleDropdown(!showVehicleDropdown)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl border border-zinc-700 hover:border-zinc-600 transition-all duration-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-gradient-to-r from-orange-500 to-red-500 p-2 rounded-lg">
                        <Car className="h-4 w-4 text-white" />
                      </div>
                      <div className="text-left">
                        {selectedVehicle ? (
                          <div>
                            <div className="text-white font-medium">{getSelectedVehicleDisplayName()}</div>
                            {getSelectedVehicle()?.nickname && (
                              <div className="flex items-center gap-1 mt-1">
                                <Heart className="h-3 w-3 text-pink-400" />
                                <span className="text-xs text-pink-400">Nickname: {getSelectedVehicle()?.nickname}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-400">Select a vehicle</span>
                        )}
                      </div>
                    </div>
                    <ChevronDown className={`h-5 w-5 text-zinc-400 transition-transform duration-200 ${showVehicleDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showVehicleDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl z-10 max-h-60 overflow-y-auto">
                      {userStats.vehicles.vehicles.map((vehicle) => (
                        <button
                          key={vehicle.id}
                          onClick={() => {
                            setSelectedVehicle(vehicle.id)
                            setShowVehicleDropdown(false)
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-700 transition-all duration-200 ${
                            selectedVehicle === vehicle.id ? 'bg-orange-500/10 border-r-2 border-orange-500' : ''
                          }`}
                        >
                          <div className="bg-gradient-to-r from-orange-500 to-red-500 p-2 rounded-lg">
                            <Car className="h-4 w-4 text-white" />
                          </div>
                          <div className="text-left flex-1">
                            <div className="text-white font-medium">
                              {vehicle.nickname ? `${vehicle.nickname} (${vehicle.displayName}${vehicle.trim ? ` ${vehicle.trim}` : ''})` : `${vehicle.displayName}${vehicle.trim ? ` ${vehicle.trim}` : ''}`}
                            </div>
                            {vehicle.nickname && (
                              <div className="flex items-center gap-1 mt-1">
                                <Heart className="h-3 w-3 text-pink-400" />
                                <span className="text-xs text-pink-400">Nickname</span>
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {userStats && (
          <UsageStatus userStats={userStats} />
        )}

        {/* Voice-First Interface */}
        <div className="text-center space-y-6">
          <VoiceInterface
            isRecording={isRecording}
            isProcessing={isProcessing}
            audioUrl={currentAudioUrl}
            isPlaying={isPlaying}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onPlayAudio={playAudio}
            onDiscardRecording={discardRecording}
            showTips={!hasConversationHistory}
          />

          {/* Toggle for text input */}
          <div className="flex items-center justify-center gap-4">
            <Button
              variant={showTextInput ? 'ghost' : 'outline'}
              size="sm"
              onClick={() => setShowTextInput(!showTextInput)}
              icon={showTextInput ? <Mic className="h-4 w-4" /> : <Keyboard className="h-4 w-4" />}
            >
              {showTextInput ? 'Switch to Voice' : 'Use Keyboard'}
            </Button>
          </div>

          {/* Text Input (when enabled) */}
          {showTextInput && (
            <Card variant="glass">
              <CardContent className="py-4">
                <form onSubmit={handleTextSubmit} className="flex gap-3">
                  <Input
                    value={currentQuestion}
                    onChange={(e) => setCurrentQuestion(e.target.value)}
                    placeholder="Type your automotive question..."
                    disabled={isProcessing}
                    className="flex-1"
                  />
                  <Button
                    type="submit"
                    disabled={!currentQuestion.trim() || isProcessing}
                    loading={isProcessing}
                  >
                    Ask
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Current Answer */}
          {currentAnswer && (
            <Card variant="elevated" className="text-left animate-in slide-in-from-bottom-2 duration-500">
              <CardContent>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-r from-orange-500 to-red-500 p-3 rounded-xl shadow-lg">
                      <Sparkles className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-lg">GreaseMonkey AI</h3>
                      <p className="text-zinc-400 text-sm">
                        {selectedVehicle
                          ? `About your ${getSelectedVehicleDisplayName()}`
                          : 'General automotive advice'
                        }
                      </p>
                    </div>
                  </div>

                  {currentAudioUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={playAudio}
                      icon={<Volume2 className="h-4 w-4" />}
                      className="shrink-0"
                    >
                      Play Audio
                    </Button>
                  )}
                </div>

                <div className="space-y-3 max-w-none">
                  {currentAnswer.split('\n').map((line, index) => (
                    <p key={index} className="mb-3 text-zinc-200 leading-relaxed last:mb-0">
                      {line || '\u00A0'}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Conversation History for Selected Vehicle */}
          {vehicleHistory.length > 0 && (
            <Card variant="glass">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3">
                    <MessageSquare className="h-5 w-5 text-orange-500" />
                    Conversation History
                    {selectedVehicle && (
                      <span className="text-sm text-zinc-400">
                        ({getSelectedVehicleDisplayName()})
                      </span>
                    )}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // Clear only this vehicle's history
                      const updatedHistory = conversationHistory.filter(msg => msg.vehicleId !== selectedVehicle)
                      setConversationHistory(updatedHistory)
                    }}
                  >
                    Clear History
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="max-h-96 overflow-y-auto">
                <div className="space-y-4">
                  {vehicleHistory.slice(0, 5).map((message) => (
                    <div key={message.id} className="p-4 bg-zinc-800/50 rounded-lg">
                      <div className="text-sm text-zinc-400 mb-2">
                        {message.timestamp.toLocaleString()}
                      </div>
                      <div className="text-orange-300 font-medium mb-2">Q: {message.question}</div>
                      <div className="text-zinc-300 text-sm line-clamp-3">{message.answer}</div>
                      {message.audioUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const audio = new Audio(message.audioUrl)
                            audio.play()
                          }}
                          className="mt-2"
                        >
                          <Volume2 className="h-4 w-4 mr-2" />
                          Play Audio
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </PageLayout>
    )
  }

  // Garage Tab
  if (activeTab === 'garage') {
    return (
      <PageLayout>
        <VehicleManager
          vehicles={userStats?.vehicles.vehicles || []}
          onCreateVehicle={createVehicle}
          onUpdateVehicle={updateVehicle}
          onDeleteVehicle={deleteVehicle}
          selectedVehicle={selectedVehicle}
          onVehicleSelect={setSelectedVehicle}
          userStats={userStats}
        />
      </PageLayout>
    )
  }

  // Documents Tab
  if (activeTab === 'documents') {
    return (
      <PageLayout>
        <DocumentManager
          documents={userStats?.documents.documents || []}
          onUploadDocument={uploadDocument}
          onDeleteDocument={deleteDocument}
          userTier={userStats?.tier || 'free_tier'}
          userStats={userStats}
        />
      </PageLayout>
    )
  }

  // Settings Tab
  if (activeTab === 'settings') {
    return (
      <PageLayout>
        <SettingsPage
          userStats={userStats}
          onClearHistory={clearConversationHistory}
          onSignOut={handleSignOut}
          onUpgrade={() => setShowPricing(true)}
        />
      </PageLayout>
    )
  }

  // Default fallback
  return <PageLayout><div>Loading...</div></PageLayout>
}

export default function Home() {
  return (
    <AuthGuard>
      <MainApp />
    </AuthGuard>
  )
}

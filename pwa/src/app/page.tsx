'use client'

import { useState, useRef, useEffect } from 'react'
import { apiGet, apiPost, apiDelete, apiPostFormData } from '@/lib/api-client'
import ClientOnly from '@/components/ClientOnly'
import { Navigation, TabType } from '@/components/Navigation'
import { ChatInterface } from '@/components/ChatInterface'
import { VehicleSelector } from '@/components/VehicleSelector'
import { UsageStatus } from '@/components/UsageStatus'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Car,
  FileText,
  Plus,
  Trash2,
  Upload,
  BarChart3,
  User,
  Crown,
  Zap,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react'

const DEFAULT_USER_ID = 'demo-user'

interface Vehicle {
  id: string
  displayName: string
  make: string
  model: string
  year: number
}

interface Document {
  id: string
  filename: string
  type: string
  status: string
  sizeMB: string
  createdAt: string
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

export default function Home() {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<string>('')
  const [activeTab, setActiveTab] = useState<TabType>('chat')
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [newVehicle, setNewVehicle] = useState({
    make: '',
    model: '',
    year: '',
    trim: '',
    engine: '',
    vin: '',
    notes: ''
  })
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [documentType, setDocumentType] = useState('service_manual')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadUserStats()
  }, [])

  const loadUserStats = async () => {
    try {
      const response = await apiGet('/api/user/stats')
      if (response.ok) {
        const stats = await response.json()
        setUserStats(stats)
      }
    } catch (error) {
      console.error('Failed to load user stats:', error)
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
      alert('Could not access microphone')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
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
        setQuestion(data.text || '')
        await askQuestion(data.text)
      } else {
        console.error('Transcription failed')
      }
    } catch (error) {
      console.error('Error transcribing audio:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const askQuestion = async (questionText: string = question) => {
    if (!questionText.trim()) return

    setIsProcessing(true)
    setAnswer('')
    setAudioUrl(null)

    try {
      const response = await apiPost('/api/ask', {
        question: questionText,
        vehicleId: selectedVehicle || undefined,
        includeDocuments: true,
      })

      const data = await response.json()

      if (data.error) {
        if (data.upgrade_required) {
          setAnswer(`❌ ${data.error}\n\n🚀 Upgrade your plan to continue asking questions and unlock premium features!`)
        } else {
          setAnswer(`❌ ${data.error}`)
        }
      } else {
        setAnswer(data.response)
        if (data.audioUrl) {
          setAudioUrl(data.audioUrl)
        }
      }

      if (!data.error) {
        loadUserStats()
      }
    } catch (error) {
      console.error('Error:', error)
      setAnswer('❌ Sorry, there was an error processing your request.')
    } finally {
      setIsProcessing(false)
    }
  }

  const playAudio = () => {
    if (audioRef.current && audioUrl) {
      audioRef.current.src = audioUrl
      audioRef.current.play()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await askQuestion()
  }

  const createVehicle = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await apiPost('/api/vehicles', {
        make: newVehicle.make,
        model: newVehicle.model,
        year: parseInt(newVehicle.year),
        trim: newVehicle.trim || undefined,
        engine: newVehicle.engine || undefined,
        vin: newVehicle.vin || undefined,
        notes: newVehicle.notes || undefined,
      })

      if (response.ok) {
        setNewVehicle({ make: '', model: '', year: '', trim: '', engine: '', vin: '', notes: '' })
        loadUserStats()
      }
    } catch (error) {
      console.error('Failed to create vehicle:', error)
    }
  }

  const deleteVehicle = async (vehicleId: string) => {
    try {
      const response = await apiDelete(`/api/vehicles/${vehicleId}`)
      if (response.ok) {
        loadUserStats()
      }
    } catch (error) {
      console.error('Failed to delete vehicle:', error)
    }
  }

  const uploadDocument = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFile) return

    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('type', documentType)

      const response = await apiPostFormData('/api/documents', formData)

      if (response.ok) {
        setUploadFile(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        loadUserStats()
      }
    } catch (error) {
      console.error('Failed to upload document:', error)
    }
  }

  const getTierDisplayName = (tier: string) => {
    const tierMap: Record<string, string> = {
      free_tier: 'Free',
      weekend_warrior: 'Weekend Warrior',
      master_tech: 'Master Tech'
    }
    return tierMap[tier] || tier
  }

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'free_tier':
        return <User className="h-5 w-5" />
      case 'weekend_warrior':
        return <Zap className="h-5 w-5" />
      case 'master_tech':
        return <Crown className="h-5 w-5" />
      default:
        return <User className="h-5 w-5" />
    }
  }

  const getUsageColor = (current: number, limit?: number) => {
    if (!limit) return 'text-green-400'
    const percentage = (current / limit) * 100
    if (percentage >= 90) return 'text-red-400'
    if (percentage >= 70) return 'text-yellow-400'
    return 'text-green-400'
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
                  <p className="text-zinc-400 mt-1">Your intelligent automotive assistant</p>
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

      {audioUrl && (
        <audio ref={audioRef} src={audioUrl} className="hidden" />
      )}
    </div>
  )

  // Chat Tab
  if (activeTab === 'chat') {
    return (
      <PageLayout>
        {userStats && userStats.vehicles.count > 0 && (
          <VehicleSelector
            vehicles={userStats.vehicles.vehicles}
            selectedVehicle={selectedVehicle}
            onVehicleChange={setSelectedVehicle}
          />
        )}

        {userStats && (
          <UsageStatus userStats={userStats} />
        )}

        <ChatInterface
          question={question}
          setQuestion={setQuestion}
          answer={answer}
          isRecording={isRecording}
          isProcessing={isProcessing}
          audioUrl={audioUrl}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          onSubmit={handleSubmit}
          onPlayAudio={playAudio}
        />
      </PageLayout>
    )
  }

  // Garage Tab
  if (activeTab === 'garage') {
    return (
      <PageLayout>
        {/* Add Vehicle Form */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Plus className="h-6 w-6 text-orange-500" />
              Add New Vehicle
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createVehicle} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                placeholder="Make (e.g., Toyota)"
                value={newVehicle.make}
                onChange={(e) => setNewVehicle({ ...newVehicle, make: e.target.value })}
                required
              />
              <Input
                placeholder="Model (e.g., Camry)"
                value={newVehicle.model}
                onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                required
              />
              <Input
                type="number"
                placeholder="Year"
                value={newVehicle.year}
                onChange={(e) => setNewVehicle({ ...newVehicle, year: e.target.value })}
                min="1900"
                max={new Date().getFullYear() + 2}
                required
              />
              <Input
                placeholder="Trim (optional)"
                value={newVehicle.trim}
                onChange={(e) => setNewVehicle({ ...newVehicle, trim: e.target.value })}
              />
              <Input
                placeholder="Engine (optional)"
                value={newVehicle.engine}
                onChange={(e) => setNewVehicle({ ...newVehicle, engine: e.target.value })}
              />
              <Input
                placeholder="VIN (optional)"
                value={newVehicle.vin}
                onChange={(e) => setNewVehicle({ ...newVehicle, vin: e.target.value })}
                maxLength={17}
              />
              <div className="md:col-span-3">
                <textarea
                  placeholder="Notes (optional)"
                  value={newVehicle.notes}
                  onChange={(e) => setNewVehicle({ ...newVehicle, notes: e.target.value })}
                  className="w-full bg-zinc-900/50 border border-zinc-700 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 placeholder:text-zinc-500 resize-none transition-all duration-200"
                  rows={3}
                />
              </div>
              <Button type="submit" className="md:col-span-3">
                Add Vehicle
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Vehicle List */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Car className="h-6 w-6 text-orange-500" />
              Your Vehicles ({userStats?.vehicles.count || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {userStats?.vehicles.vehicles.length ? (
              <div className="grid gap-4">
                {userStats.vehicles.vehicles.map((vehicle) => (
                  <Card key={vehicle.id} variant="default" className="card-hover">
                    <CardContent className="py-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="bg-gradient-to-r from-orange-500 to-red-500 p-2 rounded-lg">
                            <Car className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-white">{vehicle.displayName}</h3>
                            <p className="text-sm text-zinc-400">Added recently</p>
                          </div>
                        </div>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => deleteVehicle(vehicle.id)}
                          icon={<Trash2 className="h-4 w-4" />}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Car className="h-16 w-16 text-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-400 text-lg mb-2">No vehicles added yet</p>
                <p className="text-zinc-500 text-sm">Add your first vehicle above to get started!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </PageLayout>
    )
  }

  // Documents Tab
  if (activeTab === 'documents') {
    return (
      <PageLayout>
        {/* Upload Form */}
        {userStats?.tier !== 'free_tier' ? (
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Upload className="h-6 w-6 text-orange-500" />
                Upload Document
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={uploadDocument} className="space-y-4">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-orange-600 file:text-white file:font-medium hover:file:bg-orange-700"
                  required
                />
                <p className="text-sm text-zinc-400">PDF files only, max 50MB</p>

                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full bg-zinc-900/50 border border-zinc-700 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="service_manual">Service Manual</option>
                  <option value="repair_manual">Repair Manual</option>
                  <option value="owners_manual">Owner&apos;s Manual</option>
                  <option value="parts_catalog">Parts Catalog</option>
                  <option value="wiring_diagram">Wiring Diagram</option>
                  <option value="other">Other</option>
                </select>

                <Button
                  type="submit"
                  disabled={!uploadFile}
                  className="w-full"
                >
                  Upload Document
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card variant="glass" className="border-amber-500/20 bg-amber-900/10">
            <CardContent>
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-amber-200 font-medium">Document uploads available in paid plans</p>
                  <p className="text-amber-300/80 text-sm mt-1">
                    Upgrade to upload repair manuals and get personalized assistance!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Document List */}
        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-orange-500" />
              Your Documents ({userStats?.documents.count || 0})
              {userStats?.documents.storageUsedMB !== undefined && (
                <span className="text-sm font-normal text-zinc-400">
                  • {userStats.documents.storageUsedMB.toFixed(1)}MB used
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {userStats?.documents.documents.length ? (
              <div className="grid gap-4">
                {userStats.documents.documents.map((doc) => (
                  <Card key={doc.id} variant="default" className="card-hover">
                    <CardContent className="py-4">
                      <div className="flex justify-between items-start">
                        <div className="flex items-start gap-3">
                          <div className="bg-gradient-to-r from-orange-500 to-red-500 p-2 rounded-lg shrink-0">
                            <FileText className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-white">{doc.filename}</h3>
                            <p className="text-sm text-zinc-400 capitalize">
                              {doc.type.replace('_', ' ')} • {doc.sizeMB}MB
                            </p>
                            <p className="text-xs text-zinc-500">
                              {new Date(doc.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {doc.status === 'processed' ? (
                            <CheckCircle className="h-5 w-5 text-green-400" />
                          ) : (
                            <Clock className="h-5 w-5 text-yellow-400" />
                          )}
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                            doc.status === 'processed'
                              ? 'bg-green-900/30 text-green-400 border border-green-800'
                              : 'bg-yellow-900/30 text-yellow-400 border border-yellow-800'
                          }`}>
                            {doc.status}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-16 w-16 text-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-400 text-lg mb-2">No documents uploaded yet</p>
                <p className="text-zinc-500 text-sm">Upload repair manuals to enhance AI responses</p>
              </div>
            )}
          </CardContent>
        </Card>
      </PageLayout>
    )
  }

  // Stats Tab
  if (activeTab === 'stats') {
    return (
      <PageLayout>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Current Tier */}
          <Card variant="glass" className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-600/10" />
            <CardContent className="relative py-6">
              <div className="flex items-center gap-3 mb-2">
                {getTierIcon(userStats?.tier || 'free_tier')}
                <h3 className="font-semibold text-white">Current Plan</h3>
              </div>
              <p className="text-2xl font-bold text-gradient">
                {getTierDisplayName(userStats?.tier || 'free_tier')}
              </p>
            </CardContent>
          </Card>

          {/* Daily Usage */}
          <Card variant="default" className="card-hover">
            <CardContent className="py-6">
              <div className="flex items-center gap-3 mb-2">
                <BarChart3 className="h-5 w-5 text-orange-500" />
                <h3 className="font-semibold text-white">Today&apos;s Questions</h3>
              </div>
              <p className={`text-2xl font-bold ${getUsageColor(
                userStats?.usage.daily.ask_count || 0,
                userStats?.usage.limits.maxDailyAsks
              )}`}>
                {userStats?.usage.daily.ask_count || 0}
                {userStats?.usage.limits.maxDailyAsks && (
                  <span className="text-sm text-zinc-500 font-normal">
                    /{userStats.usage.limits.maxDailyAsks}
                  </span>
                )}
              </p>
            </CardContent>
          </Card>

          {/* Monthly Usage */}
          <Card variant="default" className="card-hover">
            <CardContent className="py-6">
              <div className="flex items-center gap-3 mb-2">
                <BarChart3 className="h-5 w-5 text-orange-500" />
                <h3 className="font-semibold text-white">This Month&apos;s Questions</h3>
              </div>
              <p className={`text-2xl font-bold ${getUsageColor(
                userStats?.usage.monthly.ask_count || 0,
                userStats?.usage.limits.maxMonthlyAsks
              )}`}>
                {userStats?.usage.monthly.ask_count || 0}
                {userStats?.usage.limits.maxMonthlyAsks && (
                  <span className="text-sm text-zinc-500 font-normal">
                    /{userStats.usage.limits.maxMonthlyAsks}
                  </span>
                )}
              </p>
            </CardContent>
          </Card>

          {/* Vehicles */}
          <Card variant="default" className="card-hover">
            <CardContent className="py-6">
              <div className="flex items-center gap-3 mb-2">
                <Car className="h-5 w-5 text-orange-500" />
                <h3 className="font-semibold text-white">Vehicles</h3>
              </div>
              <p className={`text-2xl font-bold ${getUsageColor(
                userStats?.vehicles.count || 0,
                userStats?.usage.limits.maxVehicles
              )}`}>
                {userStats?.vehicles.count || 0}
                {userStats?.usage.limits.maxVehicles && (
                  <span className="text-sm text-zinc-500 font-normal">
                    /{userStats.usage.limits.maxVehicles}
                  </span>
                )}
              </p>
            </CardContent>
          </Card>

          {/* Documents */}
          <Card variant="default" className="card-hover">
            <CardContent className="py-6">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="h-5 w-5 text-orange-500" />
                <h3 className="font-semibold text-white">Documents</h3>
              </div>
              <p className={`text-2xl font-bold ${getUsageColor(
                userStats?.documents.count || 0,
                userStats?.usage.limits.maxDocumentUploads
              )}`}>
                {userStats?.documents.count || 0}
                {userStats?.usage.limits.maxDocumentUploads && (
                  <span className="text-sm text-zinc-500 font-normal">
                    /{userStats.usage.limits.maxDocumentUploads}
                  </span>
                )}
              </p>
            </CardContent>
          </Card>

          {/* Storage */}
          <Card variant="default" className="card-hover">
            <CardContent className="py-6">
              <div className="flex items-center gap-3 mb-2">
                <Upload className="h-5 w-5 text-orange-500" />
                <h3 className="font-semibold text-white">Storage Used</h3>
              </div>
              <p className="text-2xl font-bold text-blue-400">
                {userStats?.documents.storageUsedMB?.toFixed(1) || '0.0'}MB
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Upgrade Prompt */}
        {userStats?.tier === 'free_tier' && (
          <Card variant="glass" className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-blue-600/10" />
            <CardContent className="relative">
              <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                <span className="text-2xl">🚀</span>
                Upgrade to Premium
              </h3>
              <p className="text-zinc-300 mb-6">
                Unlock unlimited questions, document uploads, vehicle garage, and priority support!
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <Card variant="default">
                  <CardContent className="py-4">
                    <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                      <Zap className="h-4 w-4 text-blue-400" />
                      Weekend Warrior - $9.99/month
                    </h4>
                    <p className="text-sm text-zinc-400">
                      50 questions/month • 20 documents • Unlimited vehicles
                    </p>
                  </CardContent>
                </Card>
                <Card variant="default">
                  <CardContent className="py-4">
                    <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                      <Crown className="h-4 w-4 text-purple-400" />
                      Master Tech - $19.99/month
                    </h4>
                    <p className="text-sm text-zinc-400">
                      200 questions/month • Unlimited documents • Priority support
                    </p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        )}
      </PageLayout>
    )
  }

  // Settings Tab (placeholder)
  if (activeTab === 'settings') {
    return (
      <PageLayout>
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-zinc-400">Settings panel coming soon...</p>
          </CardContent>
        </Card>
      </PageLayout>
    )
  }

  return null
}

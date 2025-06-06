'use client'

import { useState, useRef, useEffect, memo, useCallback } from 'react'
import { apiGet, apiPost, apiDelete, apiPostFormData, apiPut } from '@/lib/api-client'
import { useRouter } from 'next/navigation'

import { AuthGuard } from '@/components/AuthGuard'
import { MobileLayout, TabType } from '@/components/MobileLayout'
import { ChatInterface } from '@/components/ChatInterface'
import { VehicleManager } from '@/components/VehicleManager'
import { DocumentManager } from '@/components/DocumentManager'
import { SettingsPage } from '@/components/SettingsPage'
import { PricingPlans } from '@/components/PricingPlans'
import { UsageIndicator } from '@/components/UsageIndicator'

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
  Heart,
  MicOff
} from 'lucide-react'
import { UsageStats } from '@/lib/supabase/types'
import { getCurrentUser } from '@/lib/supabase'
import type { User as SupabaseUser } from '@supabase/supabase-js'

// AppSettings interface for MainApp's local state of general settings
interface AppSettings {
  voice_enabled: boolean;
  auto_play: boolean;
  playback_speed: number;
}

const initialAppSettings: AppSettings = {
  voice_enabled: true,
  auto_play: true,
  playback_speed: 1.0,
};

// Restored and detailed Vehicle interface
interface Vehicle {
  id: string;
  displayName: string; // Restored based on linter error
  make: string;        // Restored based on linter error
  model: string;       // Restored based on linter error
  year: number;        // Restored based on linter error
  nickname?: string;
  trim?: string;
  engine?: string;
  notes?: string;
  mileage?: number;
  // Add any other properties that were originally on Vehicle
}

// Restored and detailed Document interface
interface Document {
  id: string;
  filename: string;
  type: string;        // Restored based on linter error
  status: string;      // Restored based on linter error
  sizeMB: string;      // Restored based on linter error (assuming string, adjust if number)
  createdAt: string;   // Restored based on linter error (Date or string)
  category?: string;
  description?: string;
  // Add any other properties that were originally on Document
}

// UserStats interface using the detailed Vehicle and Document types
interface UserStats {
  tier: string;
  usage: UsageStats; // The type from supabase/types
  vehicles: {
    count: number;
    max?: number;
    vehicles: Vehicle[]; // Array of the detailed Vehicle objects
  };
  documents: {
    count: number;
    storageUsedMB: number; // Corrected: Single definition
    max_mb?: number;  // Corrected: Single definition
    documents: Document[]; // Array of the detailed Document objects
  };
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

interface MainAppProps {
  user: SupabaseUser
}

function MainApp({ user }: MainAppProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabType>('chat')
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState('')
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [processingQuestion, setProcessingQuestion] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [audioRecorder, setAudioRecorder] = useState<MediaRecorder | null>(null)
  const [audioChunks, setAudioChunks] = useState<Blob[]>([])
  const [showPricing, setShowPricing] = useState(false)
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([])
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)

  // Pagination state for chat messages
  const [messagesPerPage] = useState(20)
  const [currentPage, setCurrentPage] = useState(0)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false)

  const audioRef = useRef<HTMLAudioElement>(null)
  const lastProcessedQuestionRef = useRef<string>('')
  const processedCombinationsRef = useRef<Set<string>>(new Set())
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentPlayingAudio, setCurrentPlayingAudio] = useState<string | null>(null)
  const [blobUrls, setBlobUrls] = useState<string[]>([])
  const [brokenAudioUrls, setBrokenAudioUrls] = useState<Set<string>>(new Set())

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  const [appSettings, setAppSettings] = useState<AppSettings>(initialAppSettings)
  const [isLoading, setIsLoading] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const [lastQuestionTime, setLastQuestionTime] = useState<number | null>(null);

  // Helper functions for tab management (restored)
  const getTabFromUrl = (): TabType => {
    if (typeof window === 'undefined') return 'chat';
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') as TabType;
    return ['chat', 'garage', 'documents', 'settings'].includes(tab) ? tab : 'chat';
  };

  const updateUrlForTab = (tab: TabType) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (tab === 'chat') {
      url.searchParams.delete('tab');
    } else {
      url.searchParams.set('tab', tab);
    }
    window.history.replaceState({}, '', url.toString());
  };

  // Helper functions for vehicle URL management
  const getVehicleFromUrl = (): string | null => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('vehicle');
  };

  const updateUrlForVehicle = (vehicleId: string | null) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (vehicleId) {
      url.searchParams.set('vehicle', vehicleId);
    } else {
      url.searchParams.delete('vehicle');
    }
    window.history.replaceState({}, '', url.toString());
  };

  // Define loadConversationHistory before the main useEffect that uses it
  const loadConversationHistory = useCallback(async (vehicleIdToLoad?: string | null, userIdForHistory?: string | null) => {
    const effectiveUserId = userIdForHistory || user.id;
    if (!effectiveUserId) return;
    const targetVehicleId = vehicleIdToLoad !== undefined ? vehicleIdToLoad : selectedVehicle?.id;

    console.log('loadConversationHistory called:', {
      targetVehicleId,
      currentHistoryLength: conversationHistory.length,
      trackedCombinations: processedCombinationsRef.current.size
    })

    try {
      const key = `greasemonkey-conversation-history-${effectiveUserId}${targetVehicleId ? `-${targetVehicleId}` : '-general'}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);

        // Deduplicate conversation history on load - be more aggressive
        const deduplicatedHistory: ConversationMessage[] = [];
        const seenCombinations = new Set<string>();
        const seenQuestions = new Set<string>(); // Also dedupe by question alone

        console.log('🧹 Deduplicating loaded history:', { originalCount: parsed.length })

        for (const msg of parsed) {
          const combination = `${msg.question.trim()}|||${msg.answer.trim()}`;
          const questionOnly = msg.question.trim().toLowerCase();

          // Skip if we've seen this exact combination OR this exact question
          if (seenCombinations.has(combination) || seenQuestions.has(questionOnly)) {
            console.log('🗑️ Skipping duplicate:', { question: msg.question.substring(0, 50) })
            continue;
          }

          seenCombinations.add(combination);
          seenQuestions.add(questionOnly);
          deduplicatedHistory.push({
            ...msg,
            timestamp: new Date(msg.timestamp)
          });
        }

        console.log('✨ Deduplication complete:', {
          original: parsed.length,
          deduplicated: deduplicatedHistory.length,
          removed: parsed.length - deduplicatedHistory.length
        })

                // Only update if the loaded history is actually different from current
        const currentCombinations = conversationHistory.map(msg =>
          `${msg.question.trim()}|||${msg.answer.trim()}`
        );
        const loadedCombinations = deduplicatedHistory.map(msg =>
          `${msg.question.trim()}|||${msg.answer.trim()}`
        );

        const hasNewContent = loadedCombinations.some(combo => !currentCombinations.includes(combo)) ||
                             currentCombinations.some(combo => !loadedCombinations.includes(combo));

        if (!hasNewContent && conversationHistory.length > 0) {
          console.log('Skipping conversation history load - no new content detected')
          return;
        }

        console.log('Loading conversation history:', {
          current: conversationHistory.length,
          loaded: deduplicatedHistory.length,
          hasNewContent
        })

        setConversationHistory(deduplicatedHistory);

        // Update ref tracking with loaded combinations
        processedCombinationsRef.current.clear();
        deduplicatedHistory.forEach(msg => {
          const combination = `${msg.question.trim()}|||${msg.answer.trim()}`;
          processedCombinationsRef.current.add(combination);
        });

        // Save the cleaned history back to localStorage
        if (deduplicatedHistory.length !== parsed.length) {
          console.log(`Removed ${parsed.length - deduplicatedHistory.length} duplicate messages from history`);
          localStorage.setItem(key, JSON.stringify(deduplicatedHistory));
        }
      } else {
        setConversationHistory([]);
        processedCombinationsRef.current.clear();
      }
    } catch (error) {
      console.error('Error loading conversation history from localStorage:', error);
      setConversationHistory([]);
    }
  }, [selectedVehicle?.id]);

  // Save selected vehicle to localStorage
  const saveSelectedVehicle = useCallback((vehicle: Vehicle | null) => {
    try {
      const key = `greasemonkey-selected-vehicle-${user.id}`;
      if (vehicle) {
        localStorage.setItem(key, JSON.stringify(vehicle));
      } else {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.error('Error saving selected vehicle to localStorage:', error);
    }
  }, [user.id]);

  // Load selected vehicle from localStorage
  const loadSelectedVehicle = useCallback(() => {
    try {
      const key = `greasemonkey-selected-vehicle-${user.id}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsedVehicle = JSON.parse(saved);
        // Verify the vehicle still exists in userStats
        if (userStats?.vehicles?.vehicles?.find(v => v.id === parsedVehicle.id)) {
          setSelectedVehicle(parsedVehicle);
          return parsedVehicle;
        }
      }
    } catch (error) {
      console.error('Error loading selected vehicle from localStorage:', error);
    }
    return null;
  }, [user.id, userStats?.vehicles?.vehicles]);

  // Main useEffect for app initialization
  useEffect(() => {
    setIsLoading(true);
    const currentTabFromUrl = getTabFromUrl();
    setActiveTab(currentTabFromUrl); // Set initial tab from URL

    const initializeAppData = async () => {
      try {
        // DEBUG: Log initialization
        console.log('=== APP INITIALIZATION DEBUG ===')
        console.log('User ID:', user.id)
        // Load general app settings - user-specific
        const storedSettings = localStorage.getItem(`greasemonkey-settings-${user.id}`);

        let settingsToApply = initialAppSettings;
        if (storedSettings) {
          try {
            const parsedSettings = JSON.parse(storedSettings);

            settingsToApply = {
              voice_enabled: parsedSettings.voiceEnabled !== undefined ? parsedSettings.voiceEnabled : (parsedSettings.voice_enabled !== undefined ? parsedSettings.voice_enabled : initialAppSettings.voice_enabled),
              auto_play: parsedSettings.autoPlay !== undefined ? parsedSettings.autoPlay : (parsedSettings.auto_play !== undefined ? parsedSettings.auto_play : initialAppSettings.auto_play),
              playback_speed: parsedSettings.playbackSpeed !== undefined ? parsedSettings.playbackSpeed : (parsedSettings.playback_speed !== undefined ? parsedSettings.playback_speed : initialAppSettings.playback_speed),
            };
          } catch (e) { console.error("Failed to parse 'greasemonkey-settings' from localStorage:", e); }
        }
        setAppSettings(settingsToApply);
        localStorage.setItem(`greasemonkey-settings-${user.id}`, JSON.stringify(settingsToApply));

        // Load conversation history - either for selected vehicle or general
        await loadConversationHistory(selectedVehicle?.id || null, user.id);

        // Load user stats (vehicles, documents, tier info)
        await loadUserStats();

      } catch (error) {
        console.error("Error during initial app data loading:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAppData();

    // Event listener for browser back/forward for tab changes (restored)
    const handlePopState = () => {
      const urlTabOnPop = getTabFromUrl();
      setActiveTab(urlTabOnPop);

      // Also handle vehicle changes from URL
      const urlVehicleOnPop = getVehicleFromUrl();
      if (urlVehicleOnPop && userStats?.vehicles?.vehicles) {
        const vehicleFromUrl = userStats.vehicles.vehicles.find(v => v.id === urlVehicleOnPop);
        if (vehicleFromUrl && vehicleFromUrl.id !== selectedVehicle?.id) {
          setSelectedVehicle(vehicleFromUrl);
          saveSelectedVehicle(vehicleFromUrl);
        }
      } else if (!urlVehicleOnPop && selectedVehicle) {
        setSelectedVehicle(null);
        saveSelectedVehicle(null);
      }
    };
    window.addEventListener('popstate', handlePopState);

    // Storage event listener (for changes from other tabs/windows)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'greasemonkey-settings' && event.newValue) {
        try {
          const newSettings = JSON.parse(event.newValue);
          const updatedSettings = {
            voice_enabled: newSettings.voiceEnabled !== undefined ? newSettings.voiceEnabled : (newSettings.voice_enabled !== undefined ? newSettings.voice_enabled : initialAppSettings.voice_enabled),
            auto_play: newSettings.autoPlay !== undefined ? newSettings.autoPlay : (newSettings.auto_play !== undefined ? newSettings.auto_play : initialAppSettings.auto_play),
            playback_speed: newSettings.playbackSpeed !== undefined ? newSettings.playbackSpeed : (newSettings.playback_speed !== undefined ? newSettings.playback_speed : initialAppSettings.playback_speed),
          };
          setAppSettings(updatedSettings);
        } catch (e) { console.error("Failed to parse 'greasemonkey-settings' from storage event:", e); }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Custom event listener (for changes from same window/tab)
    const handleSettingsChange = (event: CustomEvent) => {
            try {
        const newSettings = event.detail;

        const updatedSettings = {
          voice_enabled: newSettings.voiceEnabled !== undefined ? newSettings.voiceEnabled : (newSettings.voice_enabled !== undefined ? newSettings.voice_enabled : appSettings.voice_enabled),
          auto_play: newSettings.autoPlay !== undefined ? newSettings.autoPlay : (newSettings.auto_play !== undefined ? newSettings.auto_play : appSettings.auto_play),
          playback_speed: newSettings.playbackSpeed !== undefined ? newSettings.playbackSpeed : (newSettings.playback_speed !== undefined ? newSettings.playback_speed : appSettings.playback_speed),
        };

        setAppSettings(updatedSettings);
      } catch (e) { console.error("Failed to handle 'greasemonkey-settings-changed' event:", e); }
    };
    window.addEventListener('greasemonkey-settings-changed', handleSettingsChange as EventListener);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('greasemonkey-settings-changed', handleSettingsChange as EventListener);
    };
  }, [selectedVehicle, loadConversationHistory]); // Updated dependencies

  // Initialize audio element
  useEffect(() => {
    if (audioRef.current) {
      const audio = audioRef.current
      audio.volume = 1.0
      audio.muted = false
      console.log('Audio element initialized:', {
        volume: audio.volume,
        muted: audio.muted
      })
    }

    // Expose test function globally for debugging
    ;(window as any).testWorkingAudio = testWorkingAudio
    ;(window as any).audioDebug = () => {
      if (audioRef.current) {
        console.log('Audio element debug info:', {
          src: audioRef.current.src,
          volume: audioRef.current.volume,
          muted: audioRef.current.muted,
          duration: audioRef.current.duration,
          currentTime: audioRef.current.currentTime,
          paused: audioRef.current.paused,
          readyState: audioRef.current.readyState,
          networkState: audioRef.current.networkState
        })
      }
    }

  }, [])

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      blobUrls.forEach(url => {
        URL.revokeObjectURL(url)
      })
    }
  }, [blobUrls])

    // Load conversation history when selected vehicle changes
  useEffect(() => {
    console.log('🚗 Vehicle changed effect triggered:', {
      vehicleId: selectedVehicle?.id,
      currentHistoryLength: conversationHistory.length
    })

    // TEMPORARILY DISABLED to debug duplicates
    // loadConversationHistory(selectedVehicle?.id || null, user.id)

    console.log('⚠️ Conversation history loading DISABLED for debugging')
  }, [selectedVehicle?.id, loadConversationHistory])

  // Load selected vehicle when userStats changes
  useEffect(() => {
    if (userStats?.vehicles?.vehicles?.length && !selectedVehicle) {
      // First try to load from URL parameter
      const vehicleIdFromUrl = getVehicleFromUrl();
      if (vehicleIdFromUrl) {
        const vehicleFromUrl = userStats.vehicles.vehicles.find(v => v.id === vehicleIdFromUrl);
        if (vehicleFromUrl) {
          setSelectedVehicle(vehicleFromUrl);
          saveSelectedVehicle(vehicleFromUrl);
          return;
        }
      }

      // If no URL parameter or vehicle not found, try localStorage
      loadSelectedVehicle();
    }
  }, [userStats?.vehicles?.vehicles, selectedVehicle, loadSelectedVehicle])

  useEffect(() => {
    // Save conversation history when it changes
    saveConversationHistory(conversationHistory)
  }, [conversationHistory])

  // Reset pagination when selected vehicle changes
  useEffect(() => {
    setCurrentPage(0)
    const vehicleHistory = getVehicleConversationHistory()
    setHasMoreMessages(vehicleHistory.length > messagesPerPage)
  }, [selectedVehicle?.id, conversationHistory.length])

  // Update hasMoreMessages when conversation history changes
  useEffect(() => {
    const vehicleHistory = getVehicleConversationHistory()
    const totalDisplayed = (currentPage + 1) * messagesPerPage
    setHasMoreMessages(vehicleHistory.length > totalDisplayed)
  }, [conversationHistory, currentPage, selectedVehicle?.id])

  const loadUserStats = useCallback(async () => {
    if (!user.id) return;
    try {
      console.log('Loading user stats for user:', user.id);
      const response = await apiGet('/api/user/stats');

      if (!response.ok) {
        throw new Error(`Failed to load user stats: ${response.status}`);
      }

      const data = await response.json();
      console.log('User stats loaded:', data);
      setUserStats(data);
    } catch (error) {
      console.error('Failed to load user stats:', error);
      setUserStats(null);
    }
  }, [user.id]);

  const saveConversationHistory = useCallback((history: ConversationMessage[], vehicleIdToSave?: string | null, userIdToSave?: string | null) => {
    const effectiveUserId = userIdToSave || user.id;
    if (!effectiveUserId) return;

    const targetVehicleId = vehicleIdToSave !== undefined ? vehicleIdToSave : selectedVehicle?.id;
    try {
      const key = `greasemonkey-conversation-history-${effectiveUserId}${targetVehicleId ? `-${targetVehicleId}` : '-general'}`;
      localStorage.setItem(key, JSON.stringify(history));
    } catch (error) {
      console.error('Error saving conversation history to localStorage:', error);
    }
  }, [selectedVehicle?.id]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    updateUrlForTab(tab);
    if (isSidebarOpen) {
      setIsSidebarOpen(false);
    }
  };

        const addToConversationHistory = (question: string, answer: string, audioUrl?: string) => {
    console.log('🔥 addToConversationHistory called:', {
      question: question.substring(0, 50),
      currentHistoryLength: conversationHistory.length,
      stack: new Error().stack?.split('\n').slice(1, 4).join(' -> ')
    })

    const combination = `${question.trim()}|||${answer.trim()}`;

    // Check ref-based tracking first (immediate, synchronous check)
    if (processedCombinationsRef.current.has(combination)) {
      console.log('❌ Duplicate detected via ref tracking, skipping:', { question: question.substring(0, 50) })
      return
    }

    // Check if this exact question/answer combo already exists in current history
    const isDuplicate = conversationHistory.some((msg) =>
      msg.question.trim() === question.trim() &&
      msg.answer.trim() === answer.trim()
    )

    if (isDuplicate) {
      console.log('❌ Duplicate detected in conversation history, skipping:', { question: question.substring(0, 50) })
      return
    }

    // Add to tracking ref BEFORE creating the message
    processedCombinationsRef.current.add(combination)

    console.log('✅ Adding new message, no duplicates found')

    const newMessage: ConversationMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // More unique ID
      question,
      answer,
      audioUrl,
      timestamp: new Date(),
      vehicleId: selectedVehicle?.id || undefined,
      vehicleContext: selectedVehicle ? getSelectedVehicleDisplayName() : undefined
    }

    // Use functional update to ensure we have the latest state
    setConversationHistory(prevHistory => {
      // Double-check for duplicates with the latest state
      const latestDuplicate = prevHistory.some((msg) =>
        msg.question.trim() === question.trim() &&
        msg.answer.trim() === answer.trim()
      )

      if (latestDuplicate) {
        console.log('❌ Last-second duplicate detected with latest state, skipping')
        return prevHistory
      }

      const updatedHistory = [newMessage, ...prevHistory].slice(0, 50)
      console.log('✅ Message added successfully:', {
        newHistoryLength: updatedHistory.length,
        messageId: newMessage.id
      })
      return updatedHistory
    })
  }

  const clearConversationHistory = async () => {
    setConversationHistory([])
    processedCombinationsRef.current.clear()
    // Remove both general and vehicle-specific conversation histories for this user
    const userId = user.id
    localStorage.removeItem(`greasemonkey-conversation-history-${userId}-general`)
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(`greasemonkey-conversation-history-${userId}-`)) {
        localStorage.removeItem(key)
      }
    }
    // Also clear current conversation
    setCurrentQuestion('')
    setCurrentAnswer('')
    setCurrentAudioUrl(null)
  }

  const getSelectedVehicle = () => {
    return userStats?.vehicles.vehicles.find(v => v.id === selectedVehicle?.id)
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
    if (!selectedVehicle) {
      // Show general conversations (no vehicle) when no vehicle is selected
      return conversationHistory.filter(msg => !msg.vehicleId)
    }
    return conversationHistory.filter(msg => msg.vehicleId === selectedVehicle.id)
  }

  // Get paginated messages for display
  const getPaginatedMessages = (): ConversationMessage[] => {
    const vehicleHistory = getVehicleConversationHistory()
    const startIndex = 0
    const endIndex = (currentPage + 1) * messagesPerPage
    return vehicleHistory.slice(startIndex, endIndex)
  }

  // Load more messages
  const loadMoreMessages = async () => {
    if (isLoadingMoreMessages) return

    setIsLoadingMoreMessages(true)

    // Simulate loading delay (remove if not needed)
    await new Promise(resolve => setTimeout(resolve, 300))

    const vehicleHistory = getVehicleConversationHistory()
    const nextPage = currentPage + 1
    const totalPossible = nextPage * messagesPerPage

    setCurrentPage(nextPage)
    setHasMoreMessages(vehicleHistory.length > totalPossible)
    setIsLoadingMoreMessages(false)
  }

  const handleSelectPlan = (planId: string, billingType: 'monthly' | 'yearly') => {
    // This would integrate with Stripe or your payment processor
    console.log(`User selected plan: ${planId} (${billingType})`)
    // For now, just close the pricing modal
    setShowPricing(false)
  }

  const handleSignOut = async () => {
    try {
      // Clear user-specific localStorage data
      const userId = user.id
      localStorage.removeItem('greasemonkey-user')
      localStorage.removeItem(`greasemonkey-conversation-history-${userId}-general`)
      localStorage.removeItem(`greasemonkey-settings-${userId}`)
      localStorage.removeItem(`greasemonkey-unit-preferences-${userId}`)

      // Clear any vehicle-specific conversation histories for this user
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith(`greasemonkey-conversation-history-${userId}-`)) {
          localStorage.removeItem(key)
        }
      }
      const { signOut } = await import('@/lib/supabase')
      await signOut()
      window.location.href = window.location.href
    } catch (error) {
      console.error('Sign out error:', error)
      window.location.href = window.location.href
    }
  };

  const handleToggleAutoplay = async () => {
    const newAutoPlayState = !appSettings.auto_play;
    const updatedAppSettings = { ...appSettings, auto_play: newAutoPlayState };
    setAppSettings(updatedAppSettings);
    localStorage.setItem(`greasemonkey-settings-${user.id}`, JSON.stringify(updatedAppSettings));

    // Dispatch custom event to notify other components (like SettingsPage if it's open)
    window.dispatchEvent(new CustomEvent('greasemonkey-settings-changed', {
      detail: updatedAppSettings
    }));

    try {
      await apiPut('/api/user/preferences', { auto_play: newAutoPlayState });
    } catch (error) {
      console.error('Failed to save autoplay preference to API:', error);
    }
  };

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
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')

      const response = await apiPostFormData('/api/stt', formData)

      if (response.ok) {
        const data = await response.json()
        const questionText = data.text || ''
        setCurrentQuestion(questionText)
        await askQuestion(questionText)
      } else {
        console.error('Transcription failed')
        setCurrentAnswer('❌ Sorry, I couldn\'t understand your question. Please try again.')
        setIsProcessing(false)
      }
    } catch (error) {
      console.error('Error transcribing audio:', error)
      setCurrentAnswer('❌ Sorry, there was an error processing your voice. Please try again.')
      setIsProcessing(false)
    }
    // Note: Don't call setIsProcessing(false) here if askQuestion was successful
    // because askQuestion will handle setting isProcessing to false
  }

      const askQuestion = async (questionText: string = currentQuestion) => {
    if (!questionText.trim()) return

    // Prevent duplicate calls - early return if already processing
    if (isProcessing) {
      console.log('askQuestion called while already processing, skipping duplicate request')
      return
    }

    // Prevent processing the same question twice in a row
    if (lastProcessedQuestionRef.current === questionText) {
      console.log('Skipping duplicate question:', questionText)
      return
    }

    // Set the processing question for UI display
    setProcessingQuestion(questionText)
    setIsProcessing(true)
    setCurrentAnswer('')
    setCurrentAudioUrl(null)
    lastProcessedQuestionRef.current = questionText
    // Stop any currently playing audio
    stopAudio()

    try {
      const response = await apiPost('/api/ask', {
        question: questionText,
        vehicleId: selectedVehicle?.id || undefined,
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
          // Auto-play the audio response only if setting is enabled
          if (appSettings.auto_play) {
            setTimeout(() => {
              console.log('Auto-playing audio:', data.audioUrl)
              playAudio(data.audioUrl)
            }, 1000) // Longer delay to ensure UI and audio element are ready
          }
        }

        // Handle auto-switched vehicle
        if (data.autoSwitchedVehicle && !selectedVehicle) {
          // Find the full vehicle object from userStats
          const autoSwitchedVehicleObj = userStats?.vehicles.vehicles.find(v => v.id === data.autoSwitchedVehicle.id)
          if (autoSwitchedVehicleObj) {
            setSelectedVehicle(autoSwitchedVehicleObj)
            console.log('Auto-switched to vehicle:', autoSwitchedVehicleObj)
          }
        }

        // Handle vehicle confirmation request (for medium confidence)
        if (data.needsVehicleConfirmation) {
          console.log('Vehicle confirmation needed for:', data.needsVehicleConfirmation)
          // The AI response should already include the confirmation question
          // We don't need to do anything special here since the AI will ask in its response
        }

        // Add to conversation history
        addToConversationHistory(questionText, data.response, data.audioUrl)

        // Reset pagination to show new message at the top
        setCurrentPage(0)

        // Clear current answer to prevent duplicate display
        setCurrentAnswer('')
      }

      if (!data.error) {
        // Don't reload user stats immediately after adding a message
        // This prevents triggering conversation history reload which causes duplicates
        setTimeout(() => {
          loadUserStats()
        }, 100) // Small delay to let conversation history settle
      }
    } catch (error) {
      console.error('Error:', error)
      setCurrentAnswer('❌ Sorry, there was an error processing your request.')
    } finally {
      setIsProcessing(false)
      setProcessingQuestion('')
    }
  }

  const playAudio = (audioUrl: string = currentAudioUrl || '') => {
    if (!audioUrl || !audioRef.current) {
      console.log('Cannot play audio: missing URL or audio element')
      return
    }

    console.log('Playing audio:', audioUrl.substring(0, 50) + '...')

    // Stop any currently playing audio first
    stopAudio()

    // Wait a bit for the stop to complete, then play new audio
    setTimeout(() => {
      if (audioRef.current) {
        let finalUrl = audioUrl

        // Convert data URL to blob URL for better browser compatibility
        if (audioUrl.startsWith('data:audio/')) {
          try {
            console.log('Converting data URL to blob URL')
            const [header, base64Data] = audioUrl.split(',')
            const mimeType = header.match(/data:([^;]+)/)?.[1] || 'audio/mpeg'
            const byteCharacters = atob(base64Data)
            const byteArray = new Uint8Array(byteCharacters.length)

            for (let i = 0; i < byteCharacters.length; i++) {
              byteArray[i] = byteCharacters.charCodeAt(i)
            }

            const blob = new Blob([byteArray], { type: mimeType })
            finalUrl = URL.createObjectURL(blob)
            setBlobUrls(prev => [...prev, finalUrl])
            console.log('Created blob URL:', finalUrl, 'Size:', blob.size, 'bytes', 'Type:', blob.type)

            // Test the blob by trying to create an Audio object
            const testAudio = new Audio(finalUrl)
            testAudio.addEventListener('loadedmetadata', () => {
              console.log('Test audio loaded metadata successfully, duration:', testAudio.duration)
            })
            testAudio.addEventListener('error', (e) => {
              console.error('Test audio failed to load:', e, testAudio.error)
            })
            testAudio.load()
          } catch (error) {
            console.error('Error converting to blob URL:', error)
            // Fall back to original URL
          }
        }

        // Set the source and load the audio
        audioRef.current.src = finalUrl

        // Ensure volume and unmuted
        audioRef.current.volume = 1.0
        audioRef.current.muted = false

        setCurrentPlayingAudio(audioUrl) // Keep original URL for state management
        setIsPlaying(true)

        console.log('Audio element state before load:', {
          src: finalUrl,
          volume: audioRef.current.volume,
          muted: audioRef.current.muted,
          duration: audioRef.current.duration,
          readyState: audioRef.current.readyState
        })

        // Wait for audio to be ready before playing
        const tryPlay = () => {
          if (audioRef.current && audioRef.current.readyState >= 3) {
            console.log('Attempting to play, readyState:', audioRef.current.readyState)

            const playPromise = audioRef.current.play()
            if (playPromise !== undefined) {
              playPromise
                .then(() => {
                  console.log('Audio started playing successfully')
                  console.log('Audio playing state:', {
                    currentTime: audioRef.current?.currentTime,
                    duration: audioRef.current?.duration,
                    paused: audioRef.current?.paused,
                    volume: audioRef.current?.volume,
                    muted: audioRef.current?.muted,
                    readyState: audioRef.current?.readyState
                  })
                })
                .catch(error => {
                  console.error('Audio play failed:', error)
                  if (error.name === 'NotAllowedError') {
                    console.log('Autoplay was prevented by browser policy. User interaction required.')
                    alert('Click the play button to hear the audio response (browser autoplay policy)')
                  }
                  // Don't mark as broken if it's just autoplay policy
                  if (error.name !== 'NotAllowedError') {
                    setBrokenAudioUrls(prev => new Set(prev).add(audioUrl))
                  }
                  setIsPlaying(false)
                  setCurrentPlayingAudio(null)
                })
            }
          } else {
            console.log('Audio not ready yet, readyState:', audioRef.current?.readyState)
          }
        }

        // Set up event listener for when audio can play through
        const handleCanPlayThrough = () => {
          console.log('Audio can play through - attempting to start, readyState:', audioRef.current?.readyState)
          tryPlay()
          audioRef.current?.removeEventListener('canplaythrough', handleCanPlayThrough)
        }

        const handleLoadedData = () => {
          console.log('Audio loaded data, readyState:', audioRef.current?.readyState)
          if (audioRef.current && audioRef.current.readyState >= 3) {
            tryPlay()
            audioRef.current?.removeEventListener('loadeddata', handleLoadedData)
          }
        }

        audioRef.current.addEventListener('canplaythrough', handleCanPlayThrough)
        audioRef.current.addEventListener('loadeddata', handleLoadedData)

        // Force reload of the audio
        audioRef.current.load()

        // Fallback: try to play after delays
        setTimeout(() => {
          if (audioRef.current && audioRef.current.readyState >= 3) {
            console.log('Fallback play attempt 1s')
            tryPlay()
          } else {
            console.log('1s fallback - not ready, readyState:', audioRef.current?.readyState)
          }
        }, 1000)

        setTimeout(() => {
          if (audioRef.current && audioRef.current.readyState >= 3) {
            console.log('Fallback play attempt 3s')
            tryPlay()
          } else {
            console.log('3s fallback - not ready, readyState:', audioRef.current?.readyState)
            console.log('Trying Web Audio API fallback')
            tryWebAudioPlayback(audioUrl)
          }
        }, 3000)
      }
    }, 150)
  }

  const stopAudio = () => {
    if (audioRef.current) {
      try {
        if (!audioRef.current.paused) {
          audioRef.current.pause()
        }
        audioRef.current.currentTime = 0
      } catch (error) {
        console.error('Error stopping audio:', error)
      }
    }
    setIsPlaying(false)
    setCurrentPlayingAudio(null)
  }

  const toggleAudio = (audioUrl: string = currentAudioUrl || '') => {
    if (isPlaying && currentPlayingAudio === audioUrl) {
      stopAudio()
    } else {
      playAudio(audioUrl)
    }
  }

  const isAudioAvailable = (audioUrl: string | null | undefined) => {
    return audioUrl && !brokenAudioUrls.has(audioUrl)
  }

  // Fallback audio playback using Web Audio API
  const tryWebAudioPlayback = async (audioUrl: string) => {
    try {
      console.log('Attempting Web Audio API playback')

      if (!audioUrl.startsWith('data:audio/')) {
        console.log('Not a data URL, skipping Web Audio API')
        return
      }

      const [header, base64Data] = audioUrl.split(',')
      const byteCharacters = atob(base64Data)
      const byteArray = new Uint8Array(byteCharacters.length)

      for (let i = 0; i < byteCharacters.length; i++) {
        byteArray[i] = byteCharacters.charCodeAt(i)
      }

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const audioBuffer = await audioContext.decodeAudioData(byteArray.buffer)

      console.log('Audio decoded successfully, duration:', audioBuffer.duration)

      const source = audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioContext.destination)

      source.start(0)
      console.log('Web Audio API playback started')

      // Update state
      setIsPlaying(true)
      setCurrentPlayingAudio(audioUrl)

      // Reset state when finished
      source.onended = () => {
        console.log('Web Audio API playback ended')
        setIsPlaying(false)
        setCurrentPlayingAudio(null)
      }

    } catch (error) {
      console.error('Web Audio API playback failed:', error)
      setIsPlaying(false)
      setCurrentPlayingAudio(null)
    }
  }

  // Test with a known working audio file
  const testWorkingAudio = () => {
    if (audioRef.current) {
      // Test with a tiny working MP3 (silence)
      const silentMp3 = 'data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAAE1wZWdhIG1wM2Vwb2NoIDEuMjAuMQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUElORwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4P////////////////////////////////8AAAAATGF2YzU2LjQxAAAAAAAAAAAAAAAAJAAAAAAAAAAAASDs90hvAAAAAAAAAAAAAAAAAAAA//MUZAAAAAGkAAAAAAAAA0gAAAAATEFN//MUZAMAAAGkAAAAAAAAA0gAAAAARTMz//MUZAYAAAGkAAAAAAAAA0gAAAAAOTU=';

      console.log('Testing with known working audio')
      audioRef.current.src = silentMp3
      audioRef.current.load()

      const testPlay = () => {
        if (audioRef.current) {
          console.log('Test audio readyState:', audioRef.current.readyState)
          if (audioRef.current.readyState >= 3) {
            audioRef.current.play().then(() => {
              console.log('Test audio played successfully!')
            }).catch(e => {
              console.error('Test audio play failed:', e)
            })
          }
        }
      }

      audioRef.current.addEventListener('canplaythrough', testPlay)
      setTimeout(testPlay, 1000)
    }
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
        if (selectedVehicle?.id === vehicleId) {
          setSelectedVehicle(null)
          saveSelectedVehicle(null)
          updateUrlForVehicle(null)
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

  // Chat handlers - defined at top level to avoid conditional hooks
  const handleChatSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (currentQuestion.trim() && !isProcessing) {
      askQuestion(currentQuestion)
      setCurrentQuestion('')
    }
  }, [currentQuestion, askQuestion, isProcessing])

  const handlePlayAudio = useCallback((audioUrl?: string) => {
    if (audioUrl) {
      toggleAudio(audioUrl)
    } else if (currentAudioUrl) {
      toggleAudio(currentAudioUrl)
    }
  }, [currentAudioUrl, toggleAudio])

  // Define tabSpecificContent
  let tabSpecificContent: React.ReactNode = null;

  // Determine tabSpecificContent based on activeTab
        if (activeTab === 'chat') {
    const vehicleHistory = getVehicleConversationHistory()
    tabSpecificContent = (
      <ChatInterface
        question={currentQuestion}
        setQuestion={setCurrentQuestion}
        answer={currentAnswer}
        isRecording={isRecording}
        isProcessing={isProcessing}
        processingQuestion={processingQuestion}
        audioUrl={currentAudioUrl}
        conversationHistory={vehicleHistory}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onSubmit={handleChatSubmit}
        onPlayAudio={handlePlayAudio}
        isPlaying={isPlaying}
        currentPlayingAudio={currentPlayingAudio}
        isVoiceInputGloballyEnabled={appSettings.voice_enabled}
        isAutoplayEnabled={appSettings.auto_play}
        onToggleAutoplay={handleToggleAutoplay}
      />
    );
  } else if (activeTab === 'garage') {
    tabSpecificContent = (
      <div className="p-4">
        <VehicleManager
          vehicles={userStats?.vehicles.vehicles || []}
          onCreateVehicle={createVehicle}
          onUpdateVehicle={updateVehicle}
          onDeleteVehicle={deleteVehicle}
          selectedVehicle={selectedVehicle?.id}
          onVehicleSelect={(vehicleId: string) => {
            const vehicleToSelect = userStats?.vehicles.vehicles.find(v => v.id === vehicleId);
            setSelectedVehicle(vehicleToSelect || null);
            saveSelectedVehicle(vehicleToSelect || null);
            updateUrlForVehicle(vehicleToSelect?.id || null);
          }}
          userStats={userStats}
        />
      </div>
    );
  } else if (activeTab === 'documents') {
    tabSpecificContent = (
      <div className="p-4">
        <DocumentManager
          documents={userStats?.documents.documents || []}
          onUploadDocument={uploadDocument}
          onDeleteDocument={deleteDocument}
          userTier={userStats?.tier || 'free_tier'}
          userStats={userStats}
        />
      </div>
    );
  } else if (activeTab === 'settings') {
    tabSpecificContent = (
      <div className="p-4">
        <SettingsPage
          userStats={userStats}
          onClearHistory={clearConversationHistory}
          onSignOut={handleSignOut}
          onUpgrade={() => setShowPricing(true)}
          appSettings={appSettings}
          user={user}
        />
      </div>
    );
  } else {
    tabSpecificContent = (
      <div className="flex items-center justify-center h-full">
        <div>Loading...</div>
      </div>
    );
  }

  // Common props for MobileLayout
  const commonLayoutProps = {
    activeTab,
    onTabChange: handleTabChange,
    userStats,
  };

  // Chat-specific props for MobileLayout, only defined if chat tab is active
  const chatLayoutProps = activeTab === 'chat' ? {
    vehicles: userStats?.vehicles.vehicles || [],
    selectedVehicle: selectedVehicle?.id,
    onVehicleSelect: (vehicleId: string) => {
      const vehicleToSelect = userStats?.vehicles.vehicles.find(v => v.id === vehicleId);
      setSelectedVehicle(vehicleToSelect || null);
      saveSelectedVehicle(vehicleToSelect || null);
      updateUrlForVehicle(vehicleToSelect?.id || null);
    },
  } : {};



  return (
    <>
      <MobileLayout {...commonLayoutProps} {...chatLayoutProps}>
        {tabSpecificContent}
        <audio
          ref={audioRef}
          className="hidden"
          preload="none"
          onLoadedData={() => {
            console.log('Audio loaded and ready to play')
            if (audioRef.current) {
              audioRef.current.volume = 1.0
              audioRef.current.muted = false
            }
          }}
          onPlay={() => console.log('Audio play event fired')}
          onPlaying={() => console.log('Audio is actually playing now')}
          onEnded={() => {
            console.log('Audio ended')
            setIsPlaying(false)
            setCurrentPlayingAudio(null)
          }}
          onPause={() => {
            console.log('Audio paused')
            setIsPlaying(false)
            setCurrentPlayingAudio(null)
          }}
          onError={(e) => {
            const audioElement = e.target as HTMLAudioElement
            const errorInfo = {
              code: audioElement?.error?.code,
              message: audioElement?.error?.message,
              networkState: audioElement?.networkState,
              readyState: audioElement?.readyState,
              src: audioElement?.src
            }
            console.error('Audio error:', errorInfo)
            if (currentPlayingAudio) {
              setBrokenAudioUrls(prev => new Set(prev).add(currentPlayingAudio))
            }
            setIsPlaying(false)
            setCurrentPlayingAudio(null)
          }}
          onCanPlay={() => console.log('Audio can start playing')}
          onVolumeChange={() => {
            if (audioRef.current) {
              console.log('Volume changed to:', audioRef.current.volume, 'Muted:', audioRef.current.muted)
            }
          }}
        />
      </MobileLayout>

      {/* Pricing Modal - Rendered globally */}
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
    </>
  );
}

export default function Home() {
  return (
    <AuthGuard>
      {(user: SupabaseUser) => <MainApp user={user} />}
    </AuthGuard>
  )
}

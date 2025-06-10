'use client'

import { useState, useRef, useEffect, memo, useCallback } from 'react'
import { apiGet, apiPost, apiDelete, apiPostFormData, apiPut } from '@/lib/api-client'
import { useRouter, usePathname } from 'next/navigation'

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
import { getCurrentUser, supabase } from '@/lib/supabase'
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
  activeTab: TabType
}

export function MainApp({ user, activeTab }: MainAppProps) {
  const router = useRouter()
  const pathname = usePathname()

  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [inactiveVehicles, setInactiveVehicles] = useState<any[]>([])
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
  const [messagesPerPage] = useState(10)
  const [hasMoreMessages, setHasMoreMessages] = useState(false)
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false)
  const [totalMessagesCount, setTotalMessagesCount] = useState(0)

  const audioRef = useRef<HTMLAudioElement>(null)
  const lastProcessedQuestionRef = useRef<string>('')
  const processedCombinationsRef = useRef<Set<string>>(new Set())
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentPlayingAudio, setCurrentPlayingAudio] = useState<string | null>(null)
  const [blobUrls, setBlobUrls] = useState<string[]>([])
  const [brokenAudioUrls, setBrokenAudioUrls] = useState<Set<string>>(new Set())

  // Enhanced audio states for better UX
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false)
  const [audioGenerationError, setAudioGenerationError] = useState<string | null>(null)
  const [audioCache, setAudioCache] = useState<Map<string, string>>(new Map())

  // Track audio cleanup to prevent memory leaks
  const audioCleanupRef = useRef<Map<string, () => void>>(new Map())
  const audioRetryCount = useRef<Map<string, number>>(new Map())

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  const [appSettings, setAppSettings] = useState<AppSettings>(initialAppSettings)
  const [isLoading, setIsLoading] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const [lastQuestionTime, setLastQuestionTime] = useState<number | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [debouncedSelectedVehicle, setDebouncedSelectedVehicle] = useState(selectedVehicle);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);

  // Helper functions for vehicle URL management (keep vehicle params, remove tab params)
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

  // Save selected vehicle to localStorage
  const saveSelectedVehicle = useCallback((vehicle: Vehicle | null) => {
    const key = `greasemonkey-selected-vehicle-${user.id}`;
    if (vehicle) {
      localStorage.setItem(key, JSON.stringify(vehicle));
    } else {
      localStorage.removeItem(key);
    }
  }, [user.id]);

  // Define loadConversationHistory before the main useEffect that uses it
  const loadConversationHistory = useCallback(async (vehicleIdToLoad?: string | null, userIdForHistory?: string | null) => {
    const effectiveUserId = userIdForHistory || user.id;
    if (!effectiveUserId) return;
    const targetVehicleId = vehicleIdToLoad !== undefined ? vehicleIdToLoad : selectedVehicle?.id;

    // Prevent concurrent conversation loads
    if (isLoadingConversations) {
      console.log('⏸️ Skipping conversation history load - already loading');
      return;
    }

    // Skip loading if we're currently processing a question to avoid race conditions
    if (isProcessing) {
      console.log('⏸️ Skipping conversation history load - currently processing question');
      return;
    }

    console.log('loadConversationHistory called:', {
      targetVehicleId,
      currentHistoryLength: conversationHistory.length,
      trackedCombinations: processedCombinationsRef.current.size
    })

    setIsLoadingConversations(true);
    try {
      // Load conversation history from Supabase
      const supabaseResult = await loadConversationsFromSupabase(targetVehicleId);
      const supabaseHistory = supabaseResult.messages;

      console.log('✅ Loaded conversation history from Supabase:', {
        count: supabaseHistory.length,
        totalCount: supabaseResult.totalCount,
        vehicleId: targetVehicleId
      });

      // Update pagination state
      setTotalMessagesCount(supabaseResult.totalCount);
      setHasMoreMessages(supabaseHistory.length < supabaseResult.totalCount);

      // Clear existing processed combinations and rebuild from loaded messages
      processedCombinationsRef.current.clear();

      // Log detailed conversation data to see if duplicates are in database
      console.log('🔍 Detailed conversation analysis:', {
        totalCount: supabaseHistory.length,
        conversations: supabaseHistory.map((msg, index) => ({
          index,
          id: msg.id,
          question: msg.question.substring(0, 50) + '...',
          answer: msg.answer.substring(0, 50) + '...',
          timestamp: msg.timestamp,
          isDuplicate: supabaseHistory.findIndex(other =>
            other.question === msg.question && other.answer === msg.answer
          ) !== index
        }))
      });

      // Check for actual duplicates
      const duplicates = supabaseHistory.filter((msg, index) =>
        supabaseHistory.findIndex(other =>
          other.question === msg.question && other.answer === msg.answer
        ) !== index
      );

      if (duplicates.length > 0) {
        console.error('🚨 DUPLICATES FOUND IN DATABASE:', duplicates);
      }

      supabaseHistory.forEach(msg => {
        const combinationKey = `${msg.question}-${msg.answer}`;
        processedCombinationsRef.current.add(combinationKey);
      });

      // Set combined history with deduplication by ID
      const uniqueMessages = supabaseHistory.filter((msg, index, arr) =>
        arr.findIndex(other => other.id === msg.id) === index
      );

      if (uniqueMessages.length !== supabaseHistory.length) {
        console.warn('🚨 Removed duplicate messages from initial load:', {
          original: supabaseHistory.length,
          unique: uniqueMessages.length,
          duplicatesRemoved: supabaseHistory.length - uniqueMessages.length
        });
      }

      setConversationHistory(uniqueMessages);

    } catch (error) {
      console.error('❌ Error loading conversation history:', error);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [user.id, isProcessing, isLoadingConversations]); // Add isLoadingConversations dependency

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

        // Load user stats FIRST (to get vehicles)
        await loadUserStats();

        // Load inactive vehicles
        await loadInactiveVehicles();

        // Note: Conversation loading will be handled by the vehicle selection effect
        console.log('⏭️ Skipping initial conversation load - will load after vehicle selection');

      } catch (error) {
        console.error("Error during initial app data loading:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAppData();

    // Event listener for browser back/forward for vehicle changes (removed tab handling)
    const handlePopState = () => {
      // Handle vehicle changes from URL
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
  }, [user.id]); // Remove selectedVehicle and loadConversationHistory dependencies

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

  // Enhanced cleanup for blob URLs and audio resources
  useEffect(() => {
    return () => {
      // Clean up blob URLs
      blobUrls.forEach(url => {
        URL.revokeObjectURL(url)
      })

      // Clean up any tracked audio resources
      audioCleanupRef.current.forEach((cleanup) => {
        cleanup()
      })
      audioCleanupRef.current.clear()

      console.log('🧹 Cleaned up audio resources and blob URLs')
    }
  }, [blobUrls])

  // Limit stored audio history to prevent unlimited growth
  useEffect(() => {
    const MAX_AUDIO_HISTORY = 10

    if (blobUrls.length > MAX_AUDIO_HISTORY) {
      const excessUrls = blobUrls.slice(MAX_AUDIO_HISTORY)
      excessUrls.forEach(url => {
        URL.revokeObjectURL(url)
        audioCleanupRef.current.delete(url)
      })
      setBlobUrls(prev => prev.slice(0, MAX_AUDIO_HISTORY))

      console.log(`🧹 Cleaned up ${excessUrls.length} excess audio URLs`)
    }
  }, [blobUrls.length])

  // Debounce vehicle selection to prevent rapid-fire calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSelectedVehicle(selectedVehicle)
    }, 150) // Reduced debounce time for faster response

    return () => clearTimeout(timer)
  }, [selectedVehicle])

  // Load conversation history when debounced vehicle changes
  useEffect(() => {
    // Skip if app is still loading or if we're currently processing
    if (isLoading || isProcessing) {
      console.log('⏸️ Skipping conversation load - app loading or processing');
      return;
    }

    // Skip if userStats haven't loaded yet (vehicles not available)
    if (!userStats) {
      console.log('⏸️ Skipping conversation load - userStats not loaded yet');
      return;
    }

    // Skip if this is the initial undefined state during app load (but allow null)
    if (debouncedSelectedVehicle === undefined && userStats?.vehicles?.vehicles?.length > 0) {
      console.log('⏸️ Skipping conversation load - vehicle selection still pending');
      return;
    }

    console.log('🚗 Debounced vehicle changed effect triggered:', {
      vehicleId: debouncedSelectedVehicle?.id || 'null',
      currentHistoryLength: conversationHistory.length,
      isLoading,
      isProcessing,
      vehicleState: debouncedSelectedVehicle === undefined ? 'undefined' : debouncedSelectedVehicle === null ? 'null' : 'set'
    });

    // Load conversations for the selected vehicle (or null if no vehicle)
    loadConversationHistory(debouncedSelectedVehicle?.id || null, user.id);
  }, [debouncedSelectedVehicle, isLoading, isProcessing, userStats]) // Watch entire debouncedSelectedVehicle object, not just ID

  // Load selected vehicle when userStats changes
  useEffect(() => {
    if (userStats?.vehicles?.vehicles?.length && !selectedVehicle) {
      // First try to load from URL parameter
      const vehicleIdFromUrl = getVehicleFromUrl();
      if (vehicleIdFromUrl) {
        const vehicleFromUrl = userStats.vehicles.vehicles.find(v => v.id === vehicleIdFromUrl);
        if (vehicleFromUrl) {
          console.log('🚗 Setting vehicle from URL:', vehicleFromUrl.displayName);
          setSelectedVehicle(vehicleFromUrl);
          setDebouncedSelectedVehicle(vehicleFromUrl); // Initialize debounced state immediately
          saveSelectedVehicle(vehicleFromUrl);
          return;
        }
      }

      // If no URL parameter or vehicle not found, try localStorage
      const loadedVehicle = loadSelectedVehicle();
      if (loadedVehicle) {
        console.log('🚗 Setting vehicle from localStorage:', loadedVehicle.displayName);
        setDebouncedSelectedVehicle(loadedVehicle); // Initialize debounced state immediately
      } else {
        console.log('🚗 No stored vehicle found, user will need to select one');
        setDebouncedSelectedVehicle(null); // Set to null instead of undefined
      }
    }
  }, [userStats?.vehicles?.vehicles, selectedVehicle, loadSelectedVehicle])

  const loadUserStats = useCallback(async () => {
    if (!user.id || isLoadingStats) return; // Prevent concurrent calls

    setIsLoadingStats(true);
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
    } finally {
      setIsLoadingStats(false);
    }
  }, [user.id, isLoadingStats]);

  const handleCheckoutReturn = async () => {
    try {
      const response = await apiPost('/api/user/checkout-return', {});
      if (response.ok) {
        const data = await response.json();
        if (data.updated) {
          await loadUserStats();
        }
      }
    } catch (error) {
      console.error('Error processing checkout return:', error);
    }
  };

  // Check for successful checkout on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true' || urlParams.get('checkout') === 'success') {
      handleCheckoutReturn();

      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  // New function to load conversations from Supabase
  const loadConversationsFromSupabase = useCallback(async (vehicleId?: string | null, offset = 0, limit = 10) => {
    try {
      // First get total count for this vehicle/user combination
      let countQuery = supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (vehicleId) {
        countQuery = countQuery.eq('vehicle_id', vehicleId);
      } else {
        countQuery = countQuery.is('vehicle_id', null);
      }

      const { count: totalCount } = await countQuery;

      // Then get the actual messages with pagination
      let query = supabase
        .from('conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (vehicleId) {
        query = query.eq('vehicle_id', vehicleId);
      } else {
        query = query.is('vehicle_id', null);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading conversations from Supabase:', error);
        return { messages: [], totalCount: 0 };
      }

      const messages = data?.map((conv: any) => ({
        id: conv.id,
        question: conv.question,
        answer: conv.answer,
        audioUrl: conv.audio_url,
        timestamp: new Date(conv.created_at),
        vehicleId: conv.vehicle_id,
        vehicleContext: conv.vehicle_id ? 'Vehicle Context' : undefined
      })) || [];

      return { messages, totalCount: totalCount || 0 };
    } catch (error) {
      console.error('Error loading conversations from Supabase:', error);
      return { messages: [], totalCount: 0 };
    }
  }, [user.id]);

    // Remove the old handleTabChange function since we're using direct routing now

  // Helper to manage blob URLs with proper cleanup
  const addBlobUrl = useCallback((blobUrl: string, cleanup?: () => void) => {
    setBlobUrls(prev => [blobUrl, ...prev])
    if (cleanup) {
      audioCleanupRef.current.set(blobUrl, cleanup)
    }
    console.log('📎 Added blob URL for tracking:', blobUrl)
  }, [])

  const removeBlobUrl = useCallback((blobUrl: string) => {
    URL.revokeObjectURL(blobUrl)
    const cleanup = audioCleanupRef.current.get(blobUrl)
    if (cleanup) {
      cleanup()
      audioCleanupRef.current.delete(blobUrl)
    }
    setBlobUrls(prev => prev.filter(url => url !== blobUrl))
    console.log('🗑️ Removed and cleaned up blob URL:', blobUrl)
  }, [])

  // Enhanced audio generation with fallbacks and caching
  const handleAudioGeneration = useCallback(async (responseText: string, serverAudioUrl?: string) => {
    const cacheKey = responseText.substring(0, 100) // Use first 100 chars as cache key

    // Check cache first
    const cachedAudio = audioCache.get(cacheKey)
    if (cachedAudio) {
      console.log('🎵 Using cached audio for response')
      setCurrentAudioUrl(cachedAudio)
      if (appSettings.auto_play) {
        setTimeout(() => playAudio(cachedAudio), 100)
      }
      return
    }

    if (serverAudioUrl) {
      // Server provided audio URL
      console.log('🎵 Using server-generated audio')
      setCurrentAudioUrl(serverAudioUrl)

      // Cache the audio URL
      setAudioCache(prev => new Map(prev).set(cacheKey, serverAudioUrl))

      if (appSettings.auto_play) {
        setTimeout(() => playAudio(serverAudioUrl), 100)
      }
    } else {
      // No audio from server - show generation state briefly, then fallback
      console.log('🎵 No audio provided by server, showing generation state')
      setIsGeneratingAudio(true)
      setAudioGenerationError(null)

      // Simulate generation attempt
      setTimeout(() => {
        setIsGeneratingAudio(false)
        setAudioGenerationError('Audio generation unavailable')
        console.log('🎵 Audio generation failed - graceful fallback to text-only')
      }, 1500)
    }
  }, [audioCache, appSettings.auto_play])

  const askQuestion = async (questionText: string = currentQuestion) => {
    console.log('🚀 FRONTEND askQuestion called with:', { questionText, isProcessing });
    if (!questionText.trim() || isProcessing) return;

    const currentTime = Date.now();
    if (lastQuestionTime && currentTime - lastQuestionTime < 1000) {
      console.log('Throttling: Question submitted too quickly');
      return;
    }
    setLastQuestionTime(currentTime);

    setIsProcessing(true);
    setProcessingQuestion(questionText);
    setCurrentAnswer(''); // Clear any existing answer
    setCurrentAudioUrl(null);
    setIsGeneratingAudio(false);
    setAudioGenerationError(null);

    try {
      // Prepare vehicles data for garage detection (pass from frontend to avoid API reload)
      const vehiclesForGarageDetection = userStats?.vehicles?.vehicles?.map(v => ({
        id: v.id,
        make: v.make,
        model: v.model,
        year: v.year,
        nickname: v.nickname,
        trim: v.trim,
        engine: v.engine,
        notes: v.notes
      })) || [];

      const requestPayload = {
        question: questionText,
        vehicleId: selectedVehicle?.id || null,
        vehicles: vehiclesForGarageDetection, // Pass vehicles to avoid API reload
      };

      console.log('Sending question with vehicles data:', {
        ...requestPayload,
        vehiclesCount: vehiclesForGarageDetection.length
      });

      const response = await apiPost('/api/ask', requestPayload);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      const data = await response.json();
      console.log('Response received:', data);

      // CRITICAL: Do NOT set currentAnswer or currentAudioUrl to avoid duplicates
      // The ChatInterface shows both `answer` prop AND `conversationHistory`
      // We only want to use conversationHistory from database to avoid duplicates

      // Handle audio generation with enhanced states but don't set currentAudioUrl
      // await handleAudioGeneration(data.answer, data.audioUrl);

      // Reload conversation history from database after backend saves it
      // Note: Skip setTimeout reload since vehicle effect will handle it after loadUserStats
      await loadUserStats();

    } catch (error: any) {
      console.error('Error asking question:', error);
      const errorMessage = error.message || 'Failed to get response. Please try again.';
      setCurrentAnswer(`Error: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
      setProcessingQuestion('');
    }
  };

  const playAudio = (audioUrl: string = currentAudioUrl || '') => {
    if (!audioUrl) {
      console.log('No audio URL provided for playback');
      return;
    }

    if (brokenAudioUrls.has(audioUrl)) {
      console.log('Audio URL is marked as broken, skipping playback:', audioUrl);
      return;
    }

    console.log('Playing audio:', audioUrl);

    if (currentPlayingAudio && currentPlayingAudio !== audioUrl) {
      stopAudio();
    }

    setCurrentPlayingAudio(audioUrl);
    setIsPlaying(true);

    if (audioRef.current) {
      console.log('Using HTML audio element for playback');

      const audio = audioRef.current;

      const handleEnded = () => {
        console.log('Audio playback ended');
        setIsPlaying(false);
        setCurrentPlayingAudio(null);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('error', handleError);
        audio.removeEventListener('canplaythrough', handleCanPlayThrough);
        audio.removeEventListener('loadeddata', handleLoadedData);
      };

      const handleError = (e: Event) => {
        console.error('Audio playback error:', e);
        console.log('Audio error details:', {
          error: audio.error,
          networkState: audio.networkState,
          readyState: audio.readyState,
          src: audio.src
        });

                // Enhanced error handling with retry logic
        const errorType = audio.error?.code
        const retryCount = audioRetryCount.current.get(audioUrl) || 0
        const canRetry = (errorType === MediaError.MEDIA_ERR_NETWORK || errorType === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) && retryCount < 2

        if (canRetry && !brokenAudioUrls.has(audioUrl)) {
          console.log(`🔄 Audio error (attempt ${retryCount + 1}/2) - trying Web Audio API fallback...`)
          audioRetryCount.current.set(audioUrl, retryCount + 1)
          tryWebAudioPlayback(audioUrl);
        } else {
          console.log('❌ Audio playback failed after retries - marking as broken')
          setBrokenAudioUrls(prev => new Set(prev).add(audioUrl));
          setAudioGenerationError('Audio playback failed');
          audioRetryCount.current.delete(audioUrl)
        }

        setIsPlaying(false);
        setCurrentPlayingAudio(null);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('error', handleError);
        audio.removeEventListener('canplaythrough', handleCanPlayThrough);
        audio.removeEventListener('loadeddata', handleLoadedData);
      };

      const tryPlay = () => {
        console.log('Attempting to play audio...');
        const playPromise = audio.play();

        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log('Audio playback started successfully');
            })
            .catch((error) => {
              console.error('Play promise rejected:', error);

              if (error.name === 'NotSupportedError' || error.name === 'NotAllowedError') {
                console.log('Trying Web Audio API fallback...');
                tryWebAudioPlayback(audioUrl);
              } else {
                setBrokenAudioUrls(prev => new Set(prev).add(audioUrl));
                setIsPlaying(false);
                setCurrentPlayingAudio(null);
              }
            });
        }
      };

      const handleCanPlayThrough = () => {
        console.log('Audio can play through');
        tryPlay();
      };

      const handleLoadedData = () => {
        console.log('Audio data loaded');
        if (audio.readyState >= 2) {
          tryPlay();
        }
      };

      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);
      audio.addEventListener('canplaythrough', handleCanPlayThrough);
      audio.addEventListener('loadeddata', handleLoadedData);

      audio.src = audioUrl;
      audio.load();

      if (audio.readyState >= 2) {
        console.log('Audio already loaded, playing immediately');
        tryPlay();
      }
    } else {
      console.log('No audio element available, trying Web Audio API');
      tryWebAudioPlayback(audioUrl);
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setIsPlaying(false);
    setCurrentPlayingAudio(null);
    console.log('Audio playback stopped');
  };

  const toggleAudio = (audioUrl: string = currentAudioUrl || '') => {
    if (isPlaying && currentPlayingAudio === audioUrl) {
      stopAudio();
    } else {
      playAudio(audioUrl);
    }
  };

  const isAudioAvailable = (audioUrl: string | null | undefined) => {
    return audioUrl && !brokenAudioUrls.has(audioUrl);
  };

  const tryWebAudioPlayback = async (audioUrl: string) => {
    try {
      console.log('🔊 Attempting Web Audio API playback as fallback...');

      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio data: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      // Resume context if suspended (common on mobile)
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      source.onended = () => {
        console.log('🔊 Web Audio playback ended successfully');
        setIsPlaying(false);
        setCurrentPlayingAudio(null);
        audioContext.close();
      };

      // Note: AudioBufferSourceNode doesn't have onerror, but we can catch decoding errors above

      source.start(0);
      console.log('🔊 Web Audio playback started successfully');

    } catch (error) {
      console.error('❌ Web Audio API playback failed:', error);
      setBrokenAudioUrls(prev => new Set(prev).add(audioUrl));
      setIsPlaying(false);
      setCurrentPlayingAudio(null);
      setAudioGenerationError('Audio playback unavailable');

      // Final fallback - show graceful message instead of alert
      console.log('🔕 All audio playback methods failed - graceful fallback to text-only mode');
    }
  };

  const testWorkingAudio = () => {
    const context = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.frequency.value = 440;
    gain.gain.value = 0.1;

    const testPlay = () => {
      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        context.close();
        console.log('Test audio completed - your speakers are working!');
      }, 200);
    };

    if (context.state === 'suspended') {
      context.resume().then(testPlay);
    } else {
      testPlay();
    }
  };

  const createVehicle = async (vehicleData: Omit<Vehicle, 'id'>) => {
    try {
      console.log('Creating vehicle with data:', vehicleData);

      const response = await apiPost('/api/vehicles', vehicleData);

      if (response.ok) {
        console.log('Vehicle created successfully');
        await loadUserStats();
        return await response.json();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create vehicle');
      }
    } catch (error) {
      console.error('Error creating vehicle:', error);
      throw error;
    }
  };

  const updateVehicle = async (id: string, updates: Partial<Vehicle>) => {
    try {
      const response = await apiPut(`/api/vehicles/${id}`, updates);
      if (response.ok) {
        await loadUserStats();
        if (selectedVehicle?.id === id) {
          const updatedVehicle = { ...selectedVehicle, ...updates };
          setSelectedVehicle(updatedVehicle);
          saveSelectedVehicle(updatedVehicle);
        }
      } else {
        throw new Error('Failed to update vehicle');
      }
    } catch (error) {
      console.error('Error updating vehicle:', error);
      throw error;
    }
  };

  const deleteVehicle = async (vehicleId: string) => {
    try {
      const response = await apiDelete(`/api/vehicles/${vehicleId}`);
      if (response.ok) {
        // If the deleted vehicle was selected, clear the selection
        if (selectedVehicle?.id === vehicleId) {
          setSelectedVehicle(null);
          saveSelectedVehicle(null);
          updateUrlForVehicle(null);
        }
        await loadUserStats();
      } else {
        throw new Error('Failed to delete vehicle');
      }
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      throw error;
    }
  };

  const uploadDocument = async (file: File, category: string, description?: string, vehicleId?: string) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);
      if (description) {
        formData.append('description', description);
      }
      if (vehicleId) {
        formData.append('vehicleId', vehicleId);
      }

      const response = await apiPostFormData('/api/documents', formData);

      if (response.ok) {
        await loadUserStats();
        return await response.json();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload document');
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  };

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

  const loadInactiveVehicles = async () => {
    try {
      const response = await apiGet('/api/vehicles/inactive')
      if (response.ok) {
        const data = await response.json()
        setInactiveVehicles(data.vehicles || [])
      } else {
        console.error('Failed to load inactive vehicles')
        setInactiveVehicles([])
      }
    } catch (error) {
      console.error('Error loading inactive vehicles:', error)
      setInactiveVehicles([])
    }
  }

  // Helper functions used in the component - moved before JSX to avoid hoisting issues
  const clearConversationHistory = async () => {
    try {
      const response = await apiDelete('/api/conversations');
      if (response.ok) {
        setConversationHistory([]);
        processedCombinationsRef.current.clear();
        console.log('Conversation history cleared');
      } else {
        throw new Error('Failed to clear conversation history');
      }
    } catch (error) {
      console.error('Error clearing conversation history:', error);
      alert('Failed to clear conversation history. Please try again.');
    }
  };

  const getSelectedVehicle = () => {
    return selectedVehicle;
  };

  const getSelectedVehicleDisplayName = () => {
    if (!selectedVehicle) return null;

    if (selectedVehicle.nickname) {
      return selectedVehicle.nickname;
    }

    return `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`;
  };

  const getVehicleConversationHistory = useCallback(() => {
    const vehicleId = selectedVehicle?.id || null;
    return conversationHistory.filter(msg =>
      (vehicleId && msg.vehicleId === vehicleId) ||
      (!vehicleId && !msg.vehicleId)
    );
  }, [conversationHistory, selectedVehicle?.id]);

  const loadMoreMessages = async () => {
    if (isLoadingMoreMessages || !hasMoreMessages) return;

    setIsLoadingMoreMessages(true);
    try {
      const nextOffset = conversationHistory.length;
      const targetVehicleId = selectedVehicle?.id;

      console.log('Loading more messages:', {
        nextOffset,
        messagesPerPage,
        targetVehicleId,
        currentHistoryLength: conversationHistory.length,
        totalMessagesCount
      });

      const result = await loadConversationsFromSupabase(targetVehicleId, nextOffset, messagesPerPage);
      const newMessages = result.messages;

      if (newMessages.length > 0) {
        // Append new messages to existing conversation history with deduplication
        setConversationHistory(prev => {
          const existingIds = new Set(prev.map(msg => msg.id));
          const uniqueNewMessages = newMessages.filter(msg => !existingIds.has(msg.id));

          console.log('📝 Deduplication check:', {
            existingCount: prev.length,
            newMessagesCount: newMessages.length,
            uniqueNewMessagesCount: uniqueNewMessages.length,
            duplicatesFiltered: newMessages.length - uniqueNewMessages.length
          });

          const updatedHistory = [...prev, ...uniqueNewMessages];

          // Update hasMoreMessages based on the actual total after deduplication
          setHasMoreMessages(updatedHistory.length < result.totalCount);

          console.log('✅ Loaded more messages:', {
            newMessagesCount: uniqueNewMessages.length,
            totalLoadedNow: updatedHistory.length,
            totalAvailable: result.totalCount,
            hasMore: updatedHistory.length < result.totalCount
          });

          return updatedHistory;
        });
      } else {
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setIsLoadingMoreMessages(false);
    }
  };

  const handleSelectPlan = (planId: string, billingType: 'monthly' | 'yearly') => {
    console.log('Plan selected:', { planId, billingType });
    setShowPricing(false);
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleToggleAutoplay = async () => {
    const newAutoplayValue = !appSettings.auto_play;
    const updatedSettings = { ...appSettings, auto_play: newAutoplayValue };
    setAppSettings(updatedSettings);
    localStorage.setItem(`greasemonkey-settings-${user.id}`, JSON.stringify(updatedSettings));

    window.dispatchEvent(new CustomEvent('greasemonkey-settings-changed', {
      detail: updatedSettings
    }));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      setAudioRecorder(recorder);
      setAudioChunks([]);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setAudioChunks(prev => [...prev, event.data]);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to start recording. Please ensure microphone access is granted.');
    }
  };

  const stopRecording = () => {
    if (audioRecorder && isRecording) {
      audioRecorder.stop();
      setIsRecording(false);
    }
  };

  const discardRecording = () => {
    setAudioChunks([]);
    setIsRecording(false);
    if (audioRecorder) {
      audioRecorder.stream.getTracks().forEach(track => track.stop());
      setAudioRecorder(null);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');

      const response = await apiPostFormData('/api/transcribe', formData);

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      return data.text;
    } catch (error) {
      console.error('Error transcribing audio:', error);
      throw error;
    }
  };

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
        hasMoreMessages={hasMoreMessages}
        isLoadingMoreMessages={isLoadingMoreMessages}
        onLoadMoreMessages={loadMoreMessages}
      />
    );
  } else if (activeTab === 'garage') {
    tabSpecificContent = (
      <div className="p-4">
        <VehicleManager
          vehicles={userStats?.vehicles.vehicles || []}
          inactiveVehicles={inactiveVehicles}
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
          userVehicles={userStats?.vehicles.vehicles || []}
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
    onTabChange: () => {}, // Placeholder since MobileLayout uses router directly now
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

  // Effect to clear selected vehicle if it becomes inactive
  useEffect(() => {
    if (userStats && selectedVehicle) {
      // Check if the currently selected vehicle is still in the active vehicles list
      const isStillActive = userStats.vehicles.vehicles.some(v => v.id === selectedVehicle.id)

      if (!isStillActive) {
        console.log('Selected vehicle is no longer active, clearing selection:', selectedVehicle.id)
        setSelectedVehicle(null)
        saveSelectedVehicle(null)
        updateUrlForVehicle(null)
      }
    }
  }, [userStats, selectedVehicle, saveSelectedVehicle])

  if (isLoading) {
    return (
      <div className="h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <audio ref={audioRef} preload="none" />
      <MobileLayout {...commonLayoutProps} {...chatLayoutProps}>
        {tabSpecificContent}
      </MobileLayout>

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
                userId={user.id}
                showCurrentPlan={true}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

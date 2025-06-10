import { useRef, useCallback, memo, useState, useEffect } from 'react'
import { Mic, Send, Volume2, StopCircle, MessageSquare, MicOff, VolumeX } from 'lucide-react'
import { Button } from './ui/Button'
import { Card, CardContent } from './ui/Card'
import { cn } from '@/lib/utils'

interface ChatMessage {
  id: string
  question: string
  answer: string
  audioUrl?: string
  timestamp: Date
}

interface ChatInterfaceProps {
  question: string
  setQuestion: (question: string) => void
  answer: string
  isRecording: boolean
  isProcessing: boolean
  processingQuestion: string
  audioUrl: string | null
  conversationHistory: ChatMessage[]
  onStartRecording: () => void
  onStopRecording: () => void
  onSubmit: (e: React.FormEvent) => void
  onPlayAudio: (audioUrl?: string) => void
  isPlaying: boolean
  currentPlayingAudio: string | null
  isVoiceInputGloballyEnabled: boolean
  isAutoplayEnabled: boolean
  onToggleAutoplay: () => void
  hasMoreMessages?: boolean
  isLoadingMoreMessages?: boolean
  onLoadMoreMessages?: () => void
}

export const ChatInterface = memo(({
  question,
  setQuestion,
  answer,
  isRecording,
  isProcessing,
  processingQuestion,
  audioUrl,
  conversationHistory,
  onStartRecording,
  onStopRecording,
  onSubmit,
  onPlayAudio,
  isPlaying,
  currentPlayingAudio,
  isVoiceInputGloballyEnabled,
  isAutoplayEnabled,
  onToggleAutoplay,
  hasMoreMessages = false,
  isLoadingMoreMessages = false,
  onLoadMoreMessages
}: ChatInterfaceProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [showPermissionHelperText, setShowPermissionHelperText] = useState(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.permissions) {
      const checkPermission = async () => {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          setMicPermission(permissionStatus.state);
          setShowPermissionHelperText(isVoiceInputGloballyEnabled && permissionStatus.state === 'prompt');

          permissionStatus.onchange = () => {
            setMicPermission(permissionStatus.state);
            setShowPermissionHelperText(isVoiceInputGloballyEnabled && permissionStatus.state === 'prompt');
          };
        } catch (error) {
          console.error("Error querying microphone permission:", error);
          setMicPermission('denied');
          setShowPermissionHelperText(false);
        }
      };
      checkPermission();
    } else {
      console.warn("navigator.permissions API not available. Microphone permission checks may be limited.");
      setMicPermission('prompt');
      setShowPermissionHelperText(isVoiceInputGloballyEnabled);
    }
  }, [isVoiceInputGloballyEnabled]);

  const handleMicClick = async () => {
    if (!isVoiceInputGloballyEnabled) {
      alert("Voice input is disabled in settings.");
      return;
    }

    if (isRecording) {
      onStopRecording();
      return;
    }

    if (micPermission === 'denied') {
      alert("Microphone access is denied. Please enable it in your browser settings and refresh the page.");
      return;
    }

    if (micPermission === 'prompt') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMicPermission('granted');
        setShowPermissionHelperText(false);
        stream.getTracks().forEach(track => track.stop());
        onStartRecording();
      } catch (err) {
        console.error("Error requesting microphone permission:", err);
        setMicPermission('denied');
        setShowPermissionHelperText(false);
        alert("Microphone permission was not granted.");
      }
    } else if (micPermission === 'granted') {
      onStartRecording();
    }
  };

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
    }
  }, [])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuestion(e.target.value)
    adjustTextareaHeight()
  }, [setQuestion, adjustTextareaHeight])

  // Auto-scroll to bottom when conversation changes
  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [])

  // Scroll to bottom when conversation history changes or processing starts
  useEffect(() => {
    scrollToBottom()
  }, [conversationHistory, isProcessing, answer, scrollToBottom])

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto">
      {/* Conversation History */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-6 scrollbar-none">
        {/* Previous Conversations - Show in reverse chronological order */}
        {conversationHistory.slice().reverse().map((message) => (
          <div key={message.id} className="space-y-4">
            {/* User Question */}
            <div className="flex justify-end">
              <div className="bg-gradient-to-r from-orange-500/30 to-red-500/20 rounded-2xl px-5 py-3 max-w-[85%] border border-orange-500/30 shadow-lg">
                <p className="text-white font-medium">{message.question}</p>
                <span className="text-xs text-orange-200/80 mt-2 block">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>

            {/* AI Answer */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center shadow-md">
                  <span className="text-sm">🤖</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-orange-400 text-sm font-semibold">
                    <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                    GreaseMonkey AI
                  </div>
                  <div className="text-xs text-zinc-500">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-zinc-900/80 to-zinc-800/50 rounded-2xl p-4 border border-zinc-800/50 shadow-lg">
                <div className="text-zinc-100 leading-relaxed space-y-3">
                  {(message.answer || '').split('\n').map((line, index) => (
                    <p key={index} className="text-base">{line || '\u00A0'}</p>
                  ))}
                </div>
                {message.audioUrl && (
                  <div className="mt-3 pt-3 border-t border-zinc-700/50">
                    <button
                      onClick={() => onPlayAudio(message.audioUrl)}
                      className="inline-flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300 bg-orange-500/10 hover:bg-orange-500/20 px-3 py-2 rounded-lg transition-all"
                    >
                      <Volume2 className="h-4 w-4" />
                      {isPlaying && currentPlayingAudio === message.audioUrl ? 'Pause' : 'Play'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Load More Messages Button */}
        {hasMoreMessages && onLoadMoreMessages && (
          <div className="flex justify-center py-4">
            <button
              onClick={onLoadMoreMessages}
              disabled={isLoadingMoreMessages}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800/50 hover:bg-zinc-700/50 border border-zinc-700/50 rounded-lg text-zinc-300 hover:text-zinc-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingMoreMessages ? (
                <>
                  <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin"></div>
                  Loading...
                </>
              ) : (
                <>
                  <MessageSquare className="h-4 w-4" />
                  Load older messages
                </>
              )}
            </button>
          </div>
        )}

        {/* Current Answer */}
        {answer && (
          <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center shadow-lg">
                <span className="text-lg">🤖</span>
              </div>
              <div>
                <div className="flex items-center gap-2 text-orange-400 text-sm font-semibold">
                  <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                  GreaseMonkey AI
                </div>
                <div className="text-xs text-zinc-500">Just now</div>
              </div>
            </div>
            <div className="bg-gradient-to-r from-zinc-900/80 to-zinc-800/50 rounded-2xl p-5 border border-zinc-800/50 shadow-xl">
              <div className="space-y-4">
                {(answer || '').split('\n').map((line, index) => (
                  <p key={index} className="text-zinc-100 leading-relaxed text-base">
                    {line || '\u00A0'}
                  </p>
                ))}
              </div>
              {audioUrl && (
                <div className="mt-4 pt-3 border-t border-zinc-700/50">
                  <button
                    onClick={() => onPlayAudio(audioUrl)}
                    className="inline-flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300 bg-orange-500/10 hover:bg-orange-500/20 px-3 py-2 rounded-lg transition-all"
                  >
                    <Volume2 className="h-4 w-4" />
                    {isPlaying && currentPlayingAudio === audioUrl ? 'Pause Audio' : 'Play Audio'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Processing State - Show in conversation format */}
        {isProcessing && processingQuestion && (
          <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
            {/* User Question */}
            <div className="flex justify-end">
              <div className="bg-gradient-to-r from-orange-500/30 to-red-500/20 rounded-2xl px-5 py-3 max-w-[85%] border border-orange-500/30 shadow-lg">
                <p className="text-white font-medium">{processingQuestion}</p>
                <span className="text-xs text-orange-200/80 mt-2 block">
                  Just now
                </span>
              </div>
            </div>

            {/* AI Typing Indicator */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center shadow-md">
                  <span className="text-sm">🤖</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-orange-400 text-sm font-semibold">
                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
                    GreaseMonkey AI
                  </div>
                  <div className="text-xs text-zinc-500">Thinking...</div>
                </div>
              </div>
              <div className="bg-gradient-to-r from-zinc-900/80 to-zinc-800/50 rounded-2xl p-4 border border-zinc-800/50 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-zinc-300 text-sm">GreaseMonkey is thinking...</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!answer && conversationHistory.length === 0 && !isProcessing && (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="relative mb-6">
              <div className="w-24 h-24 bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="h-12 w-12 text-orange-400" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center animate-bounce">
                <span className="text-sm">🔧</span>
              </div>
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Start a conversation</h3>
            <p className="text-zinc-400 text-base max-w-sm leading-relaxed mb-6">
              Ask anything about automotive repair, maintenance, or troubleshooting
            </p>
            <div className="flex flex-col gap-2 text-sm text-zinc-500">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                <span>"Why is my engine making a knocking sound?"</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                <span>"How often should I change my oil?"</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                <span>"My brake pedal feels spongy"</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area - Fixed at bottom with reduced height */}
      <div className="border-t border-zinc-800/50 bg-zinc-950/80 backdrop-blur-sm">
        <div className="p-3 pb-4">
          {/* Voice-First Interface */}
          <div className="space-y-3">
            {/* Large Prominent Voice Button - Centered and bigger */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <button
                  type="button"
                  onClick={handleMicClick}
                  disabled={isProcessing || !isVoiceInputGloballyEnabled || micPermission === 'denied'}
                  className={cn(
                    'relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg',
                    isRecording
                      ? 'bg-red-500 hover:bg-red-600 shadow-red-500/50 animate-pulse'
                      : (isVoiceInputGloballyEnabled && micPermission !== 'denied'
                          ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 shadow-orange-500/50'
                          : 'bg-zinc-600 cursor-not-allowed shadow-zinc-700/50'),
                    !isRecording && isVoiceInputGloballyEnabled && micPermission !== 'denied' && 'hover:scale-105 hover:shadow-xl',
                    'disabled:opacity-70 disabled:scale-100 disabled:cursor-not-allowed'
                  )}
                >
                  {/* Pulsing ring for voice-first emphasis */}
                  {!isRecording && !isProcessing && isVoiceInputGloballyEnabled && micPermission === 'granted' && (
                    <div className="absolute inset-0 rounded-full bg-orange-500/30 animate-ping"></div>
                  )}

                  {isRecording ? (
                    <StopCircle className="h-10 w-10 text-white relative z-10" />
                  ) : (
                    (isVoiceInputGloballyEnabled && micPermission !== 'denied')
                      ? <Mic className="h-10 w-10 text-white relative z-10" />
                      : <MicOff className="h-10 w-10 text-white relative z-10" />
                  )}
                </button>
              </div>

              {/* Voice status indicator and permission helper text */}
              <div className="mt-2 text-center h-4">
                {isRecording && (
                  <p className="text-sm text-red-400 animate-pulse">Recording...</p>
                )}
                {!isRecording && isProcessing && (
                  <p className="text-sm text-blue-400">Processing...</p>
                )}
                {showPermissionHelperText && !isRecording && !isProcessing && (
                  <p className="text-xs text-zinc-400">Tap mic to enable voice input</p>
                )}
                {!isVoiceInputGloballyEnabled && (
                  <p className="text-xs text-zinc-500">Voice input disabled in settings</p>
                )}
                {isVoiceInputGloballyEnabled && micPermission === 'denied' && (
                  <p className="text-xs text-red-500">Mic access denied in browser</p>
                )}
              </div>
            </div>

            {/* Text Input Area with Send & Autoplay Toggle */}
            <form onSubmit={onSubmit} className="relative flex items-center gap-2">
              <textarea
                ref={textareaRef}
                value={question}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onSubmit(e as any);
                  }
                }}
                placeholder="Or type your question..."
                className="flex-1 w-full resize-none rounded-xl bg-zinc-800/80 border border-zinc-700/60 text-white placeholder-zinc-500 p-3 pr-20 shadow-lg focus:ring-2 focus:ring-orange-500/70 focus:border-orange-500/70 outline-none transition-all max-h-24 scrollbar-none"
                rows={1}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <Button
                  type="submit"
                  size="sm"
                  variant="ghost"
                  className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 rounded-full p-1.5 disabled:opacity-50"
                  disabled={!question.trim() || isProcessing || isRecording}
                  title="Send Message"
                >
                  <Send className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={onToggleAutoplay}
                  className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50 rounded-full p-1.5"
                  title={isAutoplayEnabled ? "Disable Autoplay" : "Enable Autoplay"}
                >
                  {isAutoplayEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </Button>
              </div>
            </form>
          </div>

          {/* Voice hints for new users - more compact */}
          {!answer && conversationHistory.length === 0 && !isProcessing && (
            <div className="text-center mt-3">
              <p className="text-zinc-500 text-xs">
                🎤 <span className="text-orange-400 font-medium">Voice-first</span> • Just tap the mic and ask about your car
              </p>
            </div>
          )}

          {/* Recording indicator - more compact */}
          {isRecording && (
            <div className="flex items-center justify-center gap-2 mt-3 text-red-400 text-sm bg-red-500/10 rounded-lg py-2 px-3">
              <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
              <span className="font-medium">Listening... Tap mic to stop</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

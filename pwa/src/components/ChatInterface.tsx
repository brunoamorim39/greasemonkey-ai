import { useState, useRef } from 'react'
import { Mic, Send, Volume2, StopCircle } from 'lucide-react'
import { Button } from './ui/Button'
import { Card, CardContent } from './ui/Card'
import { cn } from '@/lib/utils'

interface ChatInterfaceProps {
  question: string
  setQuestion: (question: string) => void
  answer: string
  isRecording: boolean
  isProcessing: boolean
  audioUrl: string | null
  onStartRecording: () => void
  onStopRecording: () => void
  onSubmit: (e: React.FormEvent) => void
  onPlayAudio: () => void
}

export function ChatInterface({
  question,
  setQuestion,
  answer,
  isRecording,
  isProcessing,
  audioUrl,
  onStartRecording,
  onStopRecording,
  onSubmit,
  onPlayAudio
}: ChatInterfaceProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuestion(e.target.value)
    adjustTextareaHeight()
  }

  return (
    <div className="space-y-6">
      {/* Chat Input */}
      <Card variant="glass" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-red-500/5" />
        <CardContent className="relative">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={question}
                onChange={handleInputChange}
                placeholder="Ask me anything about automotive repair..."
                className="w-full bg-transparent border-0 text-white placeholder:text-zinc-400 resize-none focus:outline-none pr-24 min-h-[60px] text-lg leading-relaxed"
                rows={1}
                disabled={isProcessing}
                style={{ height: 'auto' }}
              />

              {/* Action Buttons */}
              <div className="absolute right-2 bottom-2 flex gap-2">
                <Button
                  type="button"
                  variant={isRecording ? 'danger' : 'ghost'}
                  size="sm"
                  onClick={isRecording ? onStopRecording : onStartRecording}
                  disabled={isProcessing}
                  className={cn(
                    'p-3 rounded-xl transition-all duration-300',
                    isRecording && 'animate-pulse shadow-lg shadow-red-500/50'
                  )}
                >
                  {isRecording ? (
                    <StopCircle className="h-5 w-5" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </Button>

                <Button
                  type="submit"
                  disabled={!question.trim() || isProcessing}
                  loading={isProcessing}
                  size="sm"
                  className="p-3 rounded-xl"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Processing State */}
      {isProcessing && (
        <Card variant="glass" className="animate-in slide-in-from-bottom-2 duration-300">
          <CardContent className="flex items-center justify-center py-8">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500/30" />
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent absolute inset-0"
                     style={{ animationDirection: 'reverse', animationDuration: '1s' }} />
              </div>
              <span className="text-zinc-300 font-medium">Thinking...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Response */}
      {answer && (
        <Card variant="elevated" className="animate-in slide-in-from-bottom-2 duration-500">
          <CardContent>
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-r from-orange-500 to-red-500 p-3 rounded-xl shadow-lg">
                  <span className="text-xl">🤖</span>
                </div>
                <div>
                  <h3 className="font-semibold text-white text-lg">GreaseMonkey AI</h3>
                  <p className="text-zinc-400 text-sm">Your automotive expert</p>
                </div>
              </div>

              {audioUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onPlayAudio}
                  icon={<Volume2 className="h-4 w-4" />}
                  className="shrink-0"
                >
                  Play Audio
                </Button>
              )}
            </div>

            <div className="prose prose-zinc prose-invert max-w-none">
              {answer.split('\n').map((line, index) => (
                <p key={index} className="mb-3 text-zinc-200 leading-relaxed last:mb-0">
                  {line || '\u00A0'}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

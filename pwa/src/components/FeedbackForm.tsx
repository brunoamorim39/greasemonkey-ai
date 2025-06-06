'use client'

import { useState } from 'react'
import {
  ArrowLeft,
  Bug,
  Lightbulb,
  MessageSquare,
  Send,
  Star,
  AlertCircle,
  Check
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { apiPost } from '@/lib/api-client'

interface FeedbackFormProps {
  onBack: () => void
}

type FeedbackType = 'bug' | 'feature' | 'general'

interface FeedbackData {
  type: FeedbackType
  subject: string
  description: string
  email?: string
  rating?: number
  reproduction_steps?: string
  expected_behavior?: string
  actual_behavior?: string
  urgency?: 'low' | 'medium' | 'high'
}

export function FeedbackForm({ onBack }: FeedbackFormProps) {
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('bug')
  const [formData, setFormData] = useState<FeedbackData>({
    type: 'bug',
    subject: '',
    description: '',
    email: '',
    rating: 0,
    urgency: 'medium'
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Gather system info for debugging
      const systemInfo = {
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        platform: navigator.platform
      }

      const feedbackPayload = {
        ...formData,
        type: feedbackType,
        system_info: systemInfo
      }

      const response = await apiPost('/api/feedback', feedbackPayload)

      if (response.ok) {
        setSubmitted(true)
      } else {
        throw new Error('Failed to submit feedback')
      }
    } catch (error) {
      console.error('Feedback submission error:', error)
      alert('Failed to submit feedback. Please try emailing us directly at support@greasemonkey.ai')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRating = (rating: number) => {
    setFormData(prev => ({ ...prev, rating }))
  }

  if (submitted) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">Feedback Sent!</h1>
          </div>
        </div>

        <Card>
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Thank You!</h3>
            <p className="text-zinc-400 mb-4">
              Your feedback has been submitted successfully. We'll review it and get back to you if needed.
            </p>
            <Button onClick={onBack}>
              Back to Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-white">Send Feedback</h1>
          <p className="text-zinc-400">Help us improve GreaseMonkey</p>
        </div>
      </div>

      {/* Feedback Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle>What kind of feedback do you have?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => setFeedbackType('bug')}
              className={`p-4 rounded-lg border transition-colors ${
                feedbackType === 'bug'
                  ? 'border-red-500 bg-red-500/10'
                  : 'border-zinc-700 hover:border-zinc-600'
              }`}
            >
              <Bug className="h-6 w-6 text-red-400 mx-auto mb-2" />
              <p className="font-medium text-white">Bug Report</p>
              <p className="text-sm text-zinc-400">Something isn't working</p>
            </button>

            <button
              onClick={() => setFeedbackType('feature')}
              className={`p-4 rounded-lg border transition-colors ${
                feedbackType === 'feature'
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-zinc-700 hover:border-zinc-600'
              }`}
            >
              <Lightbulb className="h-6 w-6 text-blue-400 mx-auto mb-2" />
              <p className="font-medium text-white">Feature Request</p>
              <p className="text-sm text-zinc-400">Suggest an improvement</p>
            </button>

            <button
              onClick={() => setFeedbackType('general')}
              className={`p-4 rounded-lg border transition-colors ${
                feedbackType === 'general'
                  ? 'border-green-500 bg-green-500/10'
                  : 'border-zinc-700 hover:border-zinc-600'
              }`}
            >
              <MessageSquare className="h-6 w-6 text-green-400 mx-auto mb-2" />
              <p className="font-medium text-white">General Feedback</p>
              <p className="text-sm text-zinc-400">Share your thoughts</p>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Feedback Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {feedbackType === 'bug' && <Bug className="h-5 w-5 text-red-400" />}
            {feedbackType === 'feature' && <Lightbulb className="h-5 w-5 text-blue-400" />}
            {feedbackType === 'general' && <MessageSquare className="h-5 w-5 text-green-400" />}
            {feedbackType === 'bug' && 'Report a Bug'}
            {feedbackType === 'feature' && 'Request a Feature'}
            {feedbackType === 'general' && 'General Feedback'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Subject *
              </label>
              <Input
                value={formData.subject}
                onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                placeholder={
                  feedbackType === 'bug'
                    ? 'Brief description of the issue'
                    : feedbackType === 'feature'
                    ? 'What feature would you like to see?'
                    : 'What would you like to tell us?'
                }
                required
              />
            </div>

            {/* Rating for general feedback */}
            {feedbackType === 'general' && (
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  How would you rate your experience?
                </label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleRating(star)}
                      className="p-1"
                    >
                      <Star
                        className={`h-6 w-6 transition-colors ${
                          star <= (formData.rating || 0)
                            ? 'text-yellow-400 fill-current'
                            : 'text-zinc-600'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Bug-specific fields */}
            {feedbackType === 'bug' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Urgency
                  </label>
                  <select
                    value={formData.urgency}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      urgency: e.target.value as 'low' | 'medium' | 'high'
                    }))}
                    className="block w-full rounded-md border-zinc-700 bg-zinc-800 py-2 px-3 text-white"
                  >
                    <option value="low">Low - Minor inconvenience</option>
                    <option value="medium">Medium - Affects functionality</option>
                    <option value="high">High - Blocks critical features</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    What did you expect to happen?
                  </label>
                  <textarea
                    value={formData.expected_behavior || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, expected_behavior: e.target.value }))}
                    placeholder="Describe what you thought would happen"
                    className="block w-full rounded-md border-zinc-700 bg-zinc-800 py-2 px-3 text-white h-20 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    What actually happened?
                  </label>
                  <textarea
                    value={formData.actual_behavior || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, actual_behavior: e.target.value }))}
                    placeholder="Describe what actually happened"
                    className="block w-full rounded-md border-zinc-700 bg-zinc-800 py-2 px-3 text-white h-20 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Steps to reproduce
                  </label>
                  <textarea
                    value={formData.reproduction_steps || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, reproduction_steps: e.target.value }))}
                    placeholder="1. First I did...&#10;2. Then I clicked...&#10;3. The error occurred when..."
                    className="block w-full rounded-md border-zinc-700 bg-zinc-800 py-2 px-3 text-white h-24 resize-none"
                  />
                </div>
              </>
            )}

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                {feedbackType === 'bug' ? 'Additional Details' : 'Description'} *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={
                  feedbackType === 'bug'
                    ? 'Any other details that might help us fix this issue'
                    : feedbackType === 'feature'
                    ? 'Describe the feature and how it would help you'
                    : 'Tell us more about your experience'
                }
                className="block w-full rounded-md border-zinc-700 bg-zinc-800 py-2 px-3 text-white h-32 resize-none"
                required
              />
            </div>

            {/* Contact Email */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Email (optional)
              </label>
              <Input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="your.email@example.com"
              />
              <p className="text-xs text-zinc-500 mt-1">
                We'll only use this to follow up on your feedback if needed
              </p>
            </div>

            {/* Submit */}
            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={isSubmitting || !formData.subject || !formData.description}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Feedback
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={onBack}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

'use client'

import { useState } from 'react'
import {
  ArrowLeft,
  AlertCircle,
  Clock,
  Send,
  Check,
  Phone,
  Mail,
  MessageSquare
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { apiPost } from '@/lib/api-client'

interface SupportFormProps {
  onBack: () => void
}

type Priority = 'low' | 'normal' | 'high' | 'urgent'
type Category = 'technical' | 'billing' | 'account' | 'feature' | 'other'

interface SupportTicket {
  category: Category
  priority: Priority
  subject: string
  description: string
  email: string
  phone?: string
  preferred_contact: 'email' | 'phone'
}

export function SupportForm({ onBack }: SupportFormProps) {
  const [formData, setFormData] = useState<SupportTicket>({
    category: 'technical',
    priority: 'normal',
    subject: '',
    description: '',
    email: '',
    phone: '',
    preferred_contact: 'email'
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [ticketId, setTicketId] = useState<string>('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const supportPayload = {
        ...formData,
        system_info: {
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString(),
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          platform: navigator.platform
        }
      }

      const response = await apiPost('/api/support', supportPayload)

      if (response.ok) {
        const result = await response.json()
        setTicketId(result.ticket_id || 'SUPPORT-' + Date.now())
        setSubmitted(true)
      } else {
        throw new Error('Failed to submit support request')
      }
    } catch (error) {
      console.error('Support submission error:', error)

      // Fallback to email
      const subject = encodeURIComponent(`[${formData.priority.toUpperCase()}] ${formData.subject}`)
      const body = encodeURIComponent(`
Category: ${formData.category}
Priority: ${formData.priority}
Preferred Contact: ${formData.preferred_contact}
${formData.phone ? `Phone: ${formData.phone}` : ''}

Issue Description:
${formData.description}

---
System Info:
User Agent: ${navigator.userAgent}
URL: ${window.location.href}
Time: ${new Date().toISOString()}
      `)

      window.open(`mailto:support@greasemonkey.ai?subject=${subject}&body=${body}`)
      alert('Support form failed to submit. We\'ve opened your email client as a backup.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getPriorityInfo = (priority: Priority) => {
    switch (priority) {
      case 'urgent':
        return {
          color: 'text-red-500',
          bg: 'bg-red-500/10',
          border: 'border-red-500/20',
          time: '1-2 hours',
          desc: 'Critical issues affecting core functionality'
        }
      case 'high':
        return {
          color: 'text-orange-500',
          bg: 'bg-orange-500/10',
          border: 'border-orange-500/20',
          time: '4-8 hours',
          desc: 'Important issues that impact your experience'
        }
      case 'normal':
        return {
          color: 'text-blue-500',
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/20',
          time: '1-2 business days',
          desc: 'General questions and minor issues'
        }
      case 'low':
        return {
          color: 'text-green-500',
          bg: 'bg-green-500/10',
          border: 'border-green-500/20',
          time: '3-5 business days',
          desc: 'Feature requests and suggestions'
        }
    }
  }

  if (submitted) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">Support Request Submitted!</h1>
          </div>
        </div>

        <Card>
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">We've Got Your Request!</h3>
            <p className="text-zinc-400 mb-4">
              Your support ticket has been created with ID: <span className="font-mono text-orange-400">#{ticketId}</span>
            </p>

            <div className={`${getPriorityInfo(formData.priority).bg} ${getPriorityInfo(formData.priority).border} border rounded-lg p-4 mb-4`}>
              <div className="flex items-center gap-2 justify-center mb-2">
                <Clock className={`h-4 w-4 ${getPriorityInfo(formData.priority).color}`} />
                <span className={`font-medium ${getPriorityInfo(formData.priority).color}`}>
                  Expected Response: {getPriorityInfo(formData.priority).time}
                </span>
              </div>
              <p className="text-sm text-zinc-400">
                We'll contact you via {formData.preferred_contact} at {formData.preferred_contact === 'email' ? formData.email : formData.phone}
              </p>
            </div>

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
          <h1 className="text-2xl font-bold text-white">Contact Support</h1>
          <p className="text-zinc-400">Get help from our technical support team</p>
        </div>
      </div>

      {/* Priority Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            Response Times by Priority
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(['urgent', 'high', 'normal', 'low'] as Priority[]).map((priority) => {
              const info = getPriorityInfo(priority)
              return (
                <div key={priority} className={`${info.bg} ${info.border} border rounded-lg p-3`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className={`h-4 w-4 ${info.color}`} />
                    <span className={`font-medium capitalize ${info.color}`}>{priority}</span>
                    <span className="text-sm text-zinc-500">({info.time})</span>
                  </div>
                  <p className="text-xs text-zinc-400">{info.desc}</p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Support Form */}
      <Card>
        <CardHeader>
          <CardTitle>Support Request Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Category and Priority */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as Category }))}
                  className="block w-full rounded-md border-zinc-700 bg-zinc-800 py-2 px-3 text-white"
                  required
                >
                  <option value="technical">Technical Issue</option>
                  <option value="billing">Billing & Subscriptions</option>
                  <option value="account">Account Management</option>
                  <option value="feature">Feature Request</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Priority *
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as Priority }))}
                  className="block w-full rounded-md border-zinc-700 bg-zinc-800 py-2 px-3 text-white"
                  required
                >
                  <option value="low">Low - General inquiry</option>
                  <option value="normal">Normal - Standard issue</option>
                  <option value="high">High - Important problem</option>
                  <option value="urgent">Urgent - Critical issue</option>
                </select>
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Subject *
              </label>
              <Input
                value={formData.subject}
                onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="Brief description of your issue"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Detailed Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Please provide as much detail as possible about your issue, including any error messages and steps you've already tried..."
                className="block w-full rounded-md border-zinc-700 bg-zinc-800 py-2 px-3 text-white h-32 resize-none"
                required
              />
            </div>

            {/* Contact Information */}
            <div className="border-t border-zinc-700 pt-4">
              <h3 className="text-lg font-medium text-white mb-4">Contact Information</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Email Address *
                  </label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="your.email@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Phone Number (optional)
                  </label>
                  <Input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-white mb-2">
                  Preferred Contact Method *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="email"
                      checked={formData.preferred_contact === 'email'}
                      onChange={(e) => setFormData(prev => ({ ...prev, preferred_contact: e.target.value as 'email' | 'phone' }))}
                      className="mr-2"
                    />
                    <Mail className="h-4 w-4 mr-1" />
                    Email
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="phone"
                      checked={formData.preferred_contact === 'phone'}
                      onChange={(e) => setFormData(prev => ({ ...prev, preferred_contact: e.target.value as 'email' | 'phone' }))}
                      className="mr-2"
                      disabled={!formData.phone}
                    />
                    <Phone className="h-4 w-4 mr-1" />
                    Phone
                  </label>
                </div>
                {formData.preferred_contact === 'phone' && !formData.phone && (
                  <p className="text-sm text-orange-400 mt-1">Please provide a phone number to enable phone contact</p>
                )}
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting || !formData.subject || !formData.description || !formData.email}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Support Request
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

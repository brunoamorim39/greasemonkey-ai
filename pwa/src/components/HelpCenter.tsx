'use client'

import { useState } from 'react'
import {
  ArrowLeft,
  Search,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Mail,
  ExternalLink,
  Book,
  Video,
  Zap,
  Shield,
  Settings,
  Car
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Input'

interface HelpCenterProps {
  onBack: () => void
}

interface FAQItem {
  id: string
  question: string
  answer: string
  category: string
}

const FAQ_DATA: FAQItem[] = [
  {
    id: '1',
    question: 'How do I add a vehicle to my garage?',
    answer: 'Go to the Garage tab and tap the "+" button. Enter your vehicle details including make, model, year, and any specific engine information. This helps us provide more accurate answers.',
    category: 'Getting Started'
  },
  {
    id: '2',
    question: 'What file types can I upload for documents?',
    answer: 'Currently, we support PDF files up to 25MB. You can upload service manuals, repair guides, owner\'s manuals, and other automotive documents.',
    category: 'Documents'
  },
  {
    id: '3',
    question: 'How accurate are the AI responses?',
    answer: 'Our AI is trained on factory service manuals and automotive databases. While highly accurate, always double-check critical repairs and consult a professional mechanic for safety-critical work.',
    category: 'AI & Accuracy'
  },
  {
    id: '4',
    question: 'Can I use voice commands?',
    answer: 'Yes! Enable voice input in Settings. You can ask questions by speaking, and get audio responses. Perfect for when your hands are busy working on your car.',
    category: 'Features'
  },
  {
    id: '5',
    question: 'What\'s included in the free tier?',
    answer: 'Free tier includes 3 questions per day, basic vehicle management, and access to our knowledge base. Upgrade to Pro for unlimited questions and document uploads.',
    category: 'Pricing'
  },
  {
    id: '6',
    question: 'How do I export my data?',
    answer: 'Go to Settings → Data & Privacy → Export Data. This downloads all your vehicles, questions, preferences, and document metadata in JSON format.',
    category: 'Privacy'
  },
  {
    id: '7',
    question: 'My audio isn\'t working. What should I check?',
    answer: 'Check that: 1) Audio is enabled in Settings, 2) Your device volume is up, 3) You have a good internet connection. Audio is generated in real-time.',
    category: 'Troubleshooting'
  },
  {
    id: '8',
    question: 'Can I share my uploaded documents?',
    answer: 'No, your uploaded documents are private to your account. We never share your personal documents with other users or third parties.',
    category: 'Privacy'
  }
]

const TUTORIALS = [
  {
    title: 'Getting Started with GreaseMonkey',
    description: 'Learn the basics: adding vehicles, asking questions, and navigating the app',
    duration: '5 min',
    icon: <Car className="h-5 w-5" />
  },
  {
    title: 'Uploading Service Documents',
    description: 'How to upload and organize your repair manuals and service documents',
    duration: '3 min',
    icon: <Book className="h-5 w-5" />
  },
  {
    title: 'Using Voice Commands',
    description: 'Ask questions hands-free while working in your garage',
    duration: '2 min',
    icon: <Video className="h-5 w-5" />
  },
  {
    title: 'Understanding AI Responses',
    description: 'How to interpret answers and when to seek professional help',
    duration: '4 min',
    icon: <Zap className="h-5 w-5" />
  }
]

export function HelpCenter({ onBack }: HelpCenterProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('All')

  const categories = ['All', ...Array.from(new Set(FAQ_DATA.map(faq => faq.category)))]

  const filteredFAQs = FAQ_DATA.filter(faq => {
    const matchesSearch = faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         faq.answer.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'All' || faq.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const toggleFAQ = (id: string) => {
    setExpandedFAQ(expandedFAQ === id ? null : id)
  }

  const handleContactSupport = () => {
    const subject = encodeURIComponent('GreaseMonkey Support Request')
    const body = encodeURIComponent(`Hi GreaseMonkey Support,

I need help with:

[Please describe your issue]

---
Device: ${navigator.userAgent}
URL: ${window.location.href}
Time: ${new Date().toISOString()}`)

    window.open(`mailto:support@greasemonkey.ai?subject=${subject}&body=${body}`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-white">Help Center</h1>
          <p className="text-zinc-400">Find answers and get support</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Button
          variant="outline"
          onClick={handleContactSupport}
          className="justify-start h-auto p-4"
        >
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-blue-400" />
            <div className="text-left">
              <p className="font-medium">Contact Support</p>
              <p className="text-sm text-zinc-400">Get help from our team</p>
            </div>
          </div>
        </Button>

        <Button
          variant="outline"
          onClick={() => window.open('/api/status', '_blank')}
          className="justify-start h-auto p-4"
        >
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-green-400" />
            <div className="text-left">
              <p className="font-medium">Service Status</p>
              <p className="text-sm text-zinc-400">Check system health</p>
            </div>
          </div>
        </Button>
      </div>

      {/* Tutorials - Hidden until content is ready */}
      {false && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-purple-500" />
              Quick Start Tutorials
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {TUTORIALS.map((tutorial, index) => (
                <div
                  key={index}
                  className="p-4 border border-zinc-700 rounded-lg hover:border-zinc-600 transition-colors cursor-pointer"
                  onClick={() => {
                    // TODO: Implement tutorial videos/guides
                    alert('Tutorial coming soon!')
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-purple-400">{tutorial.icon}</div>
                    <div className="flex-1">
                      <h3 className="font-medium text-white mb-1">{tutorial.title}</h3>
                      <p className="text-sm text-zinc-400 mb-2">{tutorial.description}</p>
                      <span className="text-xs text-zinc-500">{tutorial.duration}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* FAQ Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-orange-500" />
            Frequently Asked Questions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filter */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <Input
                placeholder="Search FAQ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    selectedCategory === category
                      ? 'bg-orange-500 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* FAQ Items */}
          <div className="space-y-3">
            {filteredFAQs.map(faq => (
              <div
                key={faq.id}
                className="border border-zinc-700 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => toggleFAQ(faq.id)}
                  className="w-full p-4 text-left flex items-center justify-between hover:bg-zinc-800/50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-white">{faq.question}</p>
                    <p className="text-sm text-zinc-500 mt-1">{faq.category}</p>
                  </div>
                  {expandedFAQ === faq.id ? (
                    <ChevronUp className="h-4 w-4 text-zinc-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-zinc-400" />
                  )}
                </button>

                {expandedFAQ === faq.id && (
                  <div className="px-4 pb-4 text-zinc-300">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>

          {filteredFAQs.length === 0 && (
            <div className="text-center py-8 text-zinc-400">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No FAQ items found matching your search.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contact Section */}
      <Card>
        <CardHeader>
          <CardTitle>Still Need Help?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4">
            <p className="text-zinc-400">
              Can't find what you're looking for? Our support team is here to help.
            </p>
                        <div className="flex justify-center">
              <Button onClick={handleContactSupport} className="bg-orange-500 hover:bg-orange-600">
                <Mail className="h-4 w-4 mr-2" />
                Email Support
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

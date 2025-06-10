'use client'

import { useState, useEffect } from 'react'
import { Button } from './ui/Button'
import { Card, CardContent } from './ui/Card'
import { ClientOnly } from './ClientOnly'
import {
  Mic,
  Car,
  FileText,
  Volume2,
  Zap,
  Shield,
  ArrowRight,
  CheckCircle,
  Wrench,
  Clock,
  Smartphone,
  Users,
  Star,
  Quote
} from 'lucide-react'

interface LandingPageProps {
  onGetStarted: () => void
}

interface DemoStep {
  id: number
  question: string
  answer: string
  timing: number
}

const demoSteps: DemoStep[] = [
  {
    id: 1,
    question: "What's the torque spec for the valve cover on a 2008 WRX?",
    answer: "10 Nm applied in a criss-cross pattern. Start from the center and work outward.",
    timing: 3000
  },
  {
    id: 2,
    question: "Oil capacity for my Miata?",
    answer: "4.2 quarts with filter. Use 5W-30 synthetic oil.",
    timing: 2500
  },
  {
    id: 3,
    question: "Spark plug gap for E36 M3?",
    answer: "0.8mm gap. Use NGK BKR7E plugs for best performance.",
    timing: 2800
  }
]

const testimonials = [
  {
    name: "Mike R.",
    role: "Weekend Mechanic",
    content: "Finally, I can get torque specs without wiping my hands off to grab my phone. Game changer for garage work.",
    rating: 5
  },
  {
    name: "Sarah T.",
    role: "Shop Owner",
    content: "My techs love this. Quick answers without stopping their workflow. Productivity is way up.",
    rating: 5
  },
  {
    name: "Alex K.",
    role: "Car Enthusiast",
    content: "Perfect for DIY projects. It's like having a knowledgeable friend in the garage with you.",
    rating: 5
  }
]

export function LandingPage({ onGetStarted }: LandingPageProps) {
  const [currentDemo, setCurrentDemo] = useState(0)
  const [demoText, setDemoText] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  useEffect(() => {
    const step = demoSteps[currentDemo]
    setIsTyping(true)
    setDemoText('')

    // Typing effect for question
    let i = 0
    const questionText = `"${step.question}"`
    const typeQuestion = () => {
      if (i < questionText.length) {
        setDemoText(questionText.slice(0, i + 1))
        i++
        setTimeout(typeQuestion, 50)
      } else {
        // Pause, then show answer
        setTimeout(() => {
          setDemoText(`"${step.question}"\n\n🤖 ${step.answer}`)
          setIsTyping(false)
          // Move to next step
          setTimeout(() => {
            setCurrentDemo((prev) => (prev + 1) % demoSteps.length)
          }, step.timing)
        }, 800)
      }
    }
    typeQuestion()
  }, [currentDemo])

  // Auto-start demo on mount
  useEffect(() => {
    setCurrentDemo(0)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[size:20px_20px]" />

      <ClientOnly fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 p-4 rounded-2xl shadow-glow animate-pulse mx-auto w-fit mb-4">
              <span className="text-3xl">🔧</span>
            </div>
            <p className="text-zinc-400">Loading GreaseMonkey AI...</p>
          </div>
        </div>
      }>

            {/* Hero Section */}
      <div className="relative z-10 container mx-auto px-4 pt-6 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-gradient-to-r from-orange-500 to-red-500 p-3 sm:p-4 rounded-2xl shadow-glow animate-float">
            <span className="text-3xl sm:text-4xl">🔧</span>
          </div>
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold text-gradient">
              GreaseMonkey AI
            </h1>
            <p className="text-zinc-400 text-base sm:text-lg">Voice-First Automotive Assistant</p>
          </div>
        </div>

        {/* Main Headline */}
        <div className="text-center max-w-4xl mx-auto mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-white mb-4 sm:mb-6 leading-tight px-2">
            Get automotive answers
            <br className="hidden sm:block" />
            <span className="sm:hidden"> </span>
            <span className="text-gradient">without touching your phone</span>
          </h2>
          <p className="text-lg sm:text-xl text-zinc-300 mb-6 sm:mb-8 leading-relaxed px-2">
            Hands-free AI assistant for mechanics and car enthusiasts.
            Get torque specs, repair steps, and technical info using just your voice.
          </p>

          <div className="flex justify-center px-4 sm:px-0">
            <ClientOnly fallback={
              <Button
                onClick={onGetStarted}
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-6 sm:px-8 py-4 text-base sm:text-lg font-semibold w-full sm:w-auto"
              >
                Start Free Today
              </Button>
            }>
              <Button
                onClick={onGetStarted}
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-6 sm:px-8 py-4 text-base sm:text-lg font-semibold w-full sm:w-auto"
              >
                <ArrowRight className="h-5 w-5 mr-2" />
                Start Free Today
              </Button>
            </ClientOnly>
          </div>
        </div>

                {/* Demo Section */}
        <Card className="max-w-2xl mx-auto mb-12 sm:mb-16 bg-zinc-800/50 border-zinc-700 mx-4 sm:mx-auto">
          <CardContent className="p-4 sm:p-8">
            <ClientOnly fallback={
              <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <div className="h-5 w-5 sm:h-6 sm:w-6 bg-orange-500 rounded" />
                <h3 className="text-lg sm:text-xl font-semibold text-white">Ask GreaseMonkey</h3>
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              </div>
            }>
              <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <Mic className="h-5 w-5 sm:h-6 sm:w-6 text-orange-500" />
                <h3 className="text-lg sm:text-xl font-semibold text-white">Ask GreaseMonkey</h3>
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              </div>
            </ClientOnly>

            <div className="bg-zinc-900 rounded-lg p-4 sm:p-6 h-[140px] sm:h-[160px] font-mono text-xs sm:text-sm overflow-y-auto">
              <div className="text-green-400">
                <div className="whitespace-pre-line break-words">{demoText}</div>
                {isTyping && <span className="animate-pulse">|</span>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Problem Section */}
      <div className="bg-zinc-800/30 py-12 sm:py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8 sm:mb-12">
            <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3 sm:mb-4 px-2">
              Tired of dirty hands on your phone?
            </h3>
            <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto px-2">
              We get it. You're elbow-deep in an engine bay and need a quick torque spec or repair step.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 max-w-4xl mx-auto">
            <div className="text-center space-y-3 sm:space-y-4 px-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
                <Smartphone className="h-7 w-7 sm:h-8 sm:w-8 text-red-400" />
              </div>
              <h4 className="text-base sm:text-lg font-semibold text-white">Stop & Clean</h4>
              <p className="text-sm sm:text-base text-zinc-400">
                Wipe hands, unlock phone, search through manuals
              </p>
            </div>

            <div className="text-center space-y-3 sm:space-y-4 px-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
                <Clock className="h-7 w-7 sm:h-8 sm:w-8 text-red-400" />
              </div>
              <h4 className="text-base sm:text-lg font-semibold text-white">Lose Momentum</h4>
              <p className="text-sm sm:text-base text-zinc-400">
                Break your workflow and lose focus on the task
              </p>
            </div>

            <div className="text-center space-y-3 sm:space-y-4 px-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
                <FileText className="h-7 w-7 sm:h-8 sm:w-8 text-red-400" />
              </div>
              <h4 className="text-base sm:text-lg font-semibold text-white">Dig Through Manuals</h4>
              <p className="text-sm sm:text-base text-zinc-400">
                Search through PDFs and forums for simple answers
              </p>
            </div>
          </div>
        </div>
      </div>

            {/* Features Section */}
      <div className="py-12 sm:py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8 sm:mb-12">
            <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3 sm:mb-4 px-2">
              How GreaseMonkey AI Works
            </h3>
            <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto px-2">
              Just speak your question and get instant answers. No interruptions, no dirty phones.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 max-w-6xl mx-auto">
            <div className="space-y-6 sm:space-y-8">
              <div className="flex gap-3 sm:gap-4 px-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Mic className="h-5 w-5 sm:h-6 sm:w-6 text-orange-400" />
                </div>
                <div>
                  <h4 className="text-lg sm:text-xl font-semibold text-white mb-1 sm:mb-2">Hands-Free Voice</h4>
                  <p className="text-sm sm:text-base text-zinc-400">
                    Just say "GreaseMonkey, what's the oil capacity for my WRX?"
                    Works even with gloves or dirty hands.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 sm:gap-4 px-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Car className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-lg sm:text-xl font-semibold text-white mb-1 sm:mb-2">Vehicle Memory</h4>
                  <p className="text-sm sm:text-base text-zinc-400">
                    Remembers your garage - just say "my car" and it knows exactly
                    which vehicle you're working on.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 sm:gap-4 px-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Volume2 className="h-5 w-5 sm:h-6 sm:w-6 text-green-400" />
                </div>
                <div>
                  <h4 className="text-lg sm:text-xl font-semibold text-white mb-1 sm:mb-2">Audio Responses</h4>
                  <p className="text-sm sm:text-base text-zinc-400">
                    Answers read aloud so you can keep working.
                    No need to look at a screen in low light.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 sm:gap-4 px-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-purple-400" />
                </div>
                <div>
                  <h4 className="text-lg sm:text-xl font-semibold text-white mb-1 sm:mb-2">Smart Documents</h4>
                  <p className="text-sm sm:text-base text-zinc-400">
                    Upload your service manuals and it'll reference them
                    for vehicle-specific answers.
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:pl-8 px-4 lg:px-0">
              <Card className="bg-zinc-800/50 border-zinc-700 h-full">
                <CardContent className="p-4 sm:p-8">
                  <div className="space-y-4 sm:space-y-6">
                    <div className="bg-zinc-900 rounded-lg p-3 sm:p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        <span className="text-xs sm:text-sm text-zinc-400">Listening...</span>
                      </div>
                      <p className="text-green-400 font-mono text-sm sm:text-base">
                        "What's the brake fluid spec for my 2015 F-150?"
                      </p>
                    </div>

                    <div className="bg-zinc-900 rounded-lg p-3 sm:p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Wrench className="w-3 h-3 sm:w-4 sm:h-4 text-orange-400" />
                        <span className="text-xs sm:text-sm text-zinc-400">GreaseMonkey AI</span>
                      </div>
                      <p className="text-white text-sm sm:text-base">
                        "DOT 3 brake fluid. The reservoir is located on the driver's side
                        of the engine bay. Capacity is approximately 1 quart when doing
                        a complete system flush."
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-zinc-400 text-xs sm:text-sm">
                      <Volume2 className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span>Response played through speakers</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Preview */}
      <div className="bg-zinc-800/30 py-12 sm:py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8 sm:mb-12">
            <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3 sm:mb-4 px-2">
              Start Free, Scale as Needed
            </h3>
            <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto px-2">
              Perfect for weekend warriors and professional shops alike.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 max-w-4xl mx-auto px-4 sm:px-0">
            <Card className="bg-zinc-800/50 border-zinc-700 text-center">
              <CardContent className="p-4 sm:p-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-zinc-600/50 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 text-zinc-400" />
                </div>
                <h4 className="text-lg sm:text-xl font-bold text-white mb-2">Free</h4>
                <p className="text-2xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">$0</p>
                <ul className="space-y-2 text-xs sm:text-sm text-zinc-400">
                  <li className="flex items-center gap-2 justify-center sm:justify-start">
                    <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-400 flex-shrink-0" />
                    <span>3 questions per day</span>
                  </li>
                  <li className="flex items-center gap-2 justify-center sm:justify-start">
                    <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-400 flex-shrink-0" />
                    <span>1 vehicle in garage</span>
                  </li>
                  <li className="flex items-center gap-2 justify-center sm:justify-start">
                    <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-400 flex-shrink-0" />
                    <span>Voice assistance</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-b from-blue-500/20 to-blue-600/20 border-blue-500/30 text-center relative">
              <div className="absolute -top-2 sm:-top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-500 text-white px-2 sm:px-3 py-1 rounded-full text-xs font-semibold">
                  MOST POPULAR
                </span>
              </div>
              <CardContent className="p-4 sm:p-6 pt-6 sm:pt-8">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500/50 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400" />
                </div>
                <h4 className="text-lg sm:text-xl font-bold text-white mb-2">Weekend Warrior</h4>
                <p className="text-2xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">$0.15<span className="text-base sm:text-lg">/question</span></p>
                <ul className="space-y-2 text-xs sm:text-sm text-zinc-300">
                  <li className="flex items-center gap-2 justify-center sm:justify-start">
                    <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-400 flex-shrink-0" />
                    <span>Pay only for what you use</span>
                  </li>
                  <li className="flex items-center gap-2 justify-center sm:justify-start">
                    <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-400 flex-shrink-0" />
                    <span>3 vehicles in garage</span>
                  </li>
                  <li className="flex items-center gap-2 justify-center sm:justify-start">
                    <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-400 flex-shrink-0" />
                    <span>Document uploads</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-zinc-800/50 border-zinc-700 text-center">
              <CardContent className="p-4 sm:p-6">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-500/50 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-orange-400" />
                </div>
                <h4 className="text-lg sm:text-xl font-bold text-white mb-2">Master Tech</h4>
                <p className="text-2xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">$25<span className="text-base sm:text-lg">/month</span></p>
                <ul className="space-y-2 text-xs sm:text-sm text-zinc-400">
                  <li className="flex items-center gap-2 justify-center sm:justify-start">
                    <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-400 flex-shrink-0" />
                    <span>100 questions/month</span>
                  </li>
                  <li className="flex items-center gap-2 justify-center sm:justify-start">
                    <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-400 flex-shrink-0" />
                    <span>Unlimited vehicles</span>
                  </li>
                  <li className="flex items-center gap-2 justify-center sm:justify-start">
                    <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-green-400 flex-shrink-0" />
                    <span>Priority support</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

            {/* Testimonials */}
      <div className="py-12 sm:py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8 sm:mb-12">
            <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3 sm:mb-4 px-2">
              Loved by Mechanics & Enthusiasts
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 max-w-4xl mx-auto px-4 sm:px-0">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="bg-zinc-800/50 border-zinc-700">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex gap-1 mb-3 sm:mb-4 justify-center sm:justify-start">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-3 w-3 sm:h-4 sm:w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <Quote className="h-5 w-5 sm:h-6 sm:w-6 text-zinc-600 mb-2 sm:mb-3 mx-auto sm:mx-0" />
                  <p className="text-zinc-300 mb-3 sm:mb-4 italic text-sm sm:text-base text-center sm:text-left">
                    "{testimonial.content}"
                  </p>
                  <div className="text-center sm:text-left">
                    <p className="font-semibold text-white text-sm sm:text-base">{testimonial.name}</p>
                    <p className="text-xs sm:text-sm text-zinc-400">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 py-12 sm:py-16">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3 sm:mb-4 px-2">
            Ready to work smarter?
          </h3>
          <p className="text-lg sm:text-xl text-zinc-300 mb-6 sm:mb-8 max-w-2xl mx-auto px-2">
            Join thousands of mechanics and car enthusiasts who've upgraded their garage workflow.
          </p>

          <Button
            onClick={onGetStarted}
            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white px-6 sm:px-8 py-4 text-base sm:text-lg font-semibold w-full sm:w-auto max-w-sm sm:max-w-none mx-auto"
          >
            <ArrowRight className="h-5 w-5 mr-2" />
            Start Free - No Credit Card Required
          </Button>

          <p className="text-xs sm:text-sm text-zinc-400 mt-3 sm:mt-4 px-2">
            Free tier gives you 3 questions per day • Upgrade anytime
          </p>
        </div>
      </div>
      </ClientOnly>
    </div>
  )
}

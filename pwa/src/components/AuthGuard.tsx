'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  Car,
  FileText,
  Mic,
  CheckCircle
} from 'lucide-react'
import { supabase, signIn, signUp, signOut, getCurrentUser } from '@/lib/supabase'
import type { User as SupabaseUser } from '@supabase/supabase-js'

interface AuthGuardProps {
  children: React.ReactNode | ((user: SupabaseUser) => React.ReactNode)
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Check for existing auth session
    const checkAuth = async () => {
      try {
        // First check if Supabase is properly configured
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

        console.log('AuthGuard: Checking Supabase configuration...')
        console.log('SUPABASE_URL:', supabaseUrl ? 'Present' : 'Missing')
        console.log('SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Present' : 'Missing')

        if (!supabaseUrl || !supabaseAnonKey ||
            supabaseUrl.includes('your-project-id') ||
            supabaseAnonKey.includes('your-anon-key')) {
          console.warn('AuthGuard: Supabase not properly configured, blocking access')
          setUser(null)
          setLoading(false)
          return
        }

        console.log('AuthGuard: Attempting to get current user...')
        const currentUser = await getCurrentUser()
        console.log('AuthGuard: Current user result:', currentUser ? 'User found' : 'No user')
        setUser(currentUser)
      } catch (error) {
        console.error('AuthGuard: Auth check failed:', error)
        setUser(null)
      } finally {
        console.log('AuthGuard: Auth check complete, setting loading to false')
        setLoading(false)
      }
    }

    checkAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('AuthGuard: Auth state change:', event, session ? 'Session exists' : 'No session')
      setUser(session?.user ?? null)
      if (event === 'SIGNED_OUT') {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      if (authMode === 'signup') {
        const { data, error } = await signUp(email, password, fullName)
        if (error) throw error

        if (data.user && !data.session) {
          // Email confirmation required
          alert('Please check your email for a confirmation link before signing in.')
          setAuthMode('signin')
        }
      } else {
        const { data, error } = await signIn(email, password)
        if (error) throw error
        setUser(data.user)
      }
    } catch (error: any) {
      setError(error.message || 'Authentication failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      setUser(null)
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  // Pass user and signOut to children
  if (user) {
    // Additional safety check - ensure we have a valid user object
    if (!user.id || !user.email) {
      console.warn('AuthGuard: Invalid user object detected, forcing re-authentication')
      setUser(null)
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
          <div className="text-center">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 p-4 rounded-2xl shadow-glow animate-pulse mx-auto w-fit mb-4">
              <span className="text-3xl">🔧</span>
            </div>
            <p className="text-zinc-400">Verifying authentication...</p>
          </div>
        </div>
      )
    }

    console.log('AuthGuard: User authenticated, rendering app')
    return (
      <>
        {typeof children === 'function' ? children(user) : children}
      </>
    )
  }

  if (loading) {
    console.log('AuthGuard: Still loading, showing loading screen')
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
        <div className="text-center">
          <div className="bg-gradient-to-r from-orange-500 to-red-500 p-4 rounded-2xl shadow-glow animate-pulse mx-auto w-fit mb-4">
            <span className="text-3xl">🔧</span>
          </div>
          <p className="text-zinc-400">Loading...</p>
        </div>
      </div>
    )
  }

  console.log('AuthGuard: No user authenticated, showing auth screen')
  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.15)_1px,transparent_0)] bg-[size:20px_20px]" />

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">

          {/* Left side - Branding */}
          <div className="text-center lg:text-left space-y-8">
            <div className="flex items-center justify-center lg:justify-start gap-4">
              <div className="bg-gradient-to-r from-orange-500 to-red-500 p-4 rounded-2xl shadow-glow animate-float">
                <span className="text-4xl">🔧</span>
              </div>
              <div>
                <h1 className="text-4xl lg:text-5xl font-bold text-gradient">
                  GreaseMonkey AI
                </h1>
                <p className="text-zinc-400 text-lg">Voice-First Automotive Assistant</p>
              </div>
            </div>

            <div className="space-y-6">
              <p className="text-xl text-zinc-300 leading-relaxed">
                Get instant automotive help with hands-free voice interaction.
                Perfect for when you're under the hood with dirty hands.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
                  <Mic className="h-8 w-8 text-orange-500" />
                  <div>
                    <h3 className="font-semibold text-white">Voice-First</h3>
                    <p className="text-sm text-zinc-400">Hands-free operation</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
                  <Car className="h-8 w-8 text-blue-500" />
                  <div>
                    <h3 className="font-semibold text-white">Multi-Vehicle</h3>
                    <p className="text-sm text-zinc-400">Manage your garage</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-zinc-800/50 rounded-xl border border-zinc-700">
                  <FileText className="h-8 w-8 text-green-500" />
                  <div>
                    <h3 className="font-semibold text-white">Smart Docs</h3>
                    <p className="text-sm text-zinc-400">Upload manuals</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Auth Form */}
          <div className="flex justify-center lg:justify-end">
            <Card variant="elevated" className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="text-center">
                  {authMode === 'signin' ? 'Welcome Back' : 'Get Started'}
                </CardTitle>
                <p className="text-zinc-400 text-center text-sm">
                  {authMode === 'signin'
                    ? 'Sign in to access your automotive assistant'
                    : 'Create your account to start getting automotive help'
                  }
                </p>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                                    {authMode === 'signup' && (
                    <div className="space-y-2">
                      <label htmlFor="full-name-input" className="block text-sm font-medium text-zinc-300">
                        Full Name
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-zinc-400" />
                        <Input
                          id="full-name-input"
                          type="text"
                          placeholder="Enter your full name"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="pl-10"
                          required={authMode === 'signup'}
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label htmlFor="email-input" className="block text-sm font-medium text-zinc-300">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-zinc-400" />
                      <Input
                        id="email-input"
                        type="email"
                        placeholder="Enter your email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="password-input" className="block text-sm font-medium text-zinc-300">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-zinc-400" />
                      <Input
                        id="password-input"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-zinc-400 hover:text-zinc-300"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-red-400 text-sm">{error}</p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    loading={isSubmitting}
                    className="w-full"
                    icon={<ArrowRight className="h-4 w-4" />}
                  >
                    {authMode === 'signin' ? 'Sign In' : 'Create Account'}
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode(authMode === 'signin' ? 'signup' : 'signin')
                        setError('')
                      }}
                      className="text-orange-400 hover:text-orange-300 text-sm transition-colors"
                    >
                      {authMode === 'signin'
                        ? "Don't have an account? Sign up"
                        : 'Already have an account? Sign in'
                      }
                    </button>
                  </div>
                </form>

                {authMode === 'signup' && (
                  <div className="mt-6 pt-6 border-t border-zinc-700">
                    <div className="space-y-3">
                      <h4 className="text-white font-medium text-sm">What you get with GreaseMonkey AI:</h4>
                      <div className="space-y-2">
                        {[
                          'Voice-first automotive assistance',
                          'Multi-vehicle garage management',
                          'Document upload and analysis',
                          'Personalized repair guidance'
                        ].map((feature, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-400" />
                            <span className="text-zinc-400 text-sm">{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

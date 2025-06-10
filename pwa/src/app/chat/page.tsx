'use client'

import { AuthGuard } from '@/components/AuthGuard'
import { MainApp } from '@/components/MainApp'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export default function ChatPage() {
  return (
    <AuthGuard>
      {(user: SupabaseUser) => <MainApp user={user} activeTab="chat" />}
    </AuthGuard>
  )
}

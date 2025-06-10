'use client'

import { AuthGuard } from '@/components/AuthGuard'
import { MainApp } from '@/components/MainApp'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export default function GaragePage() {
  return (
    <AuthGuard>
      {(user: SupabaseUser) => <MainApp user={user} activeTab="garage" />}
    </AuthGuard>
  )
}

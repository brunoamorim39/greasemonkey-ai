import { createClient } from '@supabase/supabase-js'
import { Database, UnitPreferences, UserTier, UsageStats, UsageType } from '../supabase/types'
import { TIER_LIMITS } from '../config'

// Create service role client for backend operations (bypasses RLS)
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export class UserService {
  async getUserTier(userId: string): Promise<UserTier> {
    try {
      const { data, error } = await supabase
        .from('user_tiers')
        .select('tier, tier_override, tier_override_expires_at')
        .eq('user_id', userId)
        .single()

      // If table doesn't exist or other errors, return default tier
      if (error && (error.code === '42P01' || error.code !== 'PGRST116')) {
        console.warn('user_tiers table not found or error, using default tier:', error.message)
        return 'free_tier'
      }

      if (!data) {
        // Create default tier for new user - but only if table exists
        // Skip creation if table doesn't exist
        return 'free_tier'
      }

      // Check if tier override is active
      if (data.tier_override && data.tier_override_expires_at) {
        const expiresAt = new Date(data.tier_override_expires_at)
        if (expiresAt > new Date()) {
          return data.tier_override
        }
      }

      return data.tier
    } catch (error) {
      console.error('Error in getUserTier:', error)
      return 'free_tier'
    }
  }

  async createUserTier(userId: string, tier: UserTier = 'free_tier'): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_tiers')
        .insert({
          user_id: userId,
          tier,
        })

      if (error) {
        if (error.code === '42P01') {
          console.warn('user_tiers table does not exist, skipping tier creation')
        } else {
          console.error('Error creating user tier:', error)
        }
      }
    } catch (error) {
      console.error('Error in createUserTier:', error)
    }
  }

  async getUserPreferences(userId: string): Promise<UnitPreferences> {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user preferences:', error)
        return this.getDefaultPreferences()
      }

      if (!data) {
        // Create default preferences for new user
        const defaultPrefs = this.getDefaultPreferences()
        await this.updateUserPreferences(userId, defaultPrefs)
        return defaultPrefs
      }

      return {
        torque_unit: data.torque_unit,
        pressure_unit: data.pressure_unit,
        length_unit: data.length_unit,
        volume_unit: data.volume_unit,
        temperature_unit: data.temperature_unit,
        weight_unit: data.weight_unit,
        socket_unit: data.socket_unit,
      }
    } catch (error) {
      console.error('Error in getUserPreferences:', error)
      return this.getDefaultPreferences()
    }
  }

  async updateUserPreferences(userId: string, preferences: Partial<UnitPreferences>): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert(
          {
            user_id: userId,
            ...preferences,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id',
          }
        )

      if (error) {
        console.error('Error updating user preferences:', error)
        throw error
      }
    } catch (error) {
      console.error('Error in updateUserPreferences:', error)
      throw error
    }
  }

  private getDefaultPreferences(): UnitPreferences {
    return {
      torque_unit: 'pound_feet',
      pressure_unit: 'psi',
      length_unit: 'imperial',
      volume_unit: 'imperial',
      temperature_unit: 'fahrenheit',
      weight_unit: 'imperial',
      socket_unit: 'imperial',
      auto_play: true,
      voice_enabled: true,
      playback_speed: 1.0,
    }
  }

  async trackUsage(userId: string, usageType: UsageType, details?: Record<string, unknown>): Promise<boolean> {
    try {
      const today = new Date().toISOString().split('T')[0]

      // Insert usage record
      const { error: usageError } = await supabase
        .from('usage_records')
        .insert({
          user_id: userId,
          usage_type: usageType,
          usage_date: today,
          details: details || null,
        })

      if (usageError) {
        console.error('Error tracking usage:', usageError)
        return false
      }

      // Update daily stats
      await this.updateDailyStats(userId, usageType, today)

      return true
    } catch (error) {
      console.error('Error in trackUsage:', error)
      return false
    }
  }

  private async updateDailyStats(userId: string, usageType: UsageType, date: string): Promise<void> {
    try {
      // Get current stats
      const { data: existing } = await supabase
        .from('daily_usage_stats')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .single()

      const increment = { [usageType + '_count']: 1 }

      if (existing) {
        // Update existing record
        const { error } = await supabase
          .from('daily_usage_stats')
          .update({
            ...increment,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)

        if (error) {
          console.error('Error updating daily stats:', error)
        }
      } else {
        // Create new record
        const { error } = await supabase
          .from('daily_usage_stats')
          .insert({
            user_id: userId,
            date,
            ask_count: usageType === 'ask' ? 1 : 0,
            document_upload_count: usageType === 'document_upload' ? 1 : 0,
            tts_count: usageType === 'tts' ? 1 : 0,
            stt_count: usageType === 'stt' ? 1 : 0,
            total_cost_cents: 0,
          })

        if (error) {
          console.error('Error creating daily stats:', error)
        }
      }
    } catch (error) {
      console.error('Error in updateDailyStats:', error)
    }
  }

  async checkUsageLimit(userId: string, usageType: UsageType): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const tier = await this.getUserTier(userId)
      const limits = TIER_LIMITS[tier]
      const today = new Date().toISOString().split('T')[0]

      if (usageType === 'ask') {
        // Check daily limit
        if (limits.maxDailyAsks !== null && limits.maxDailyAsks !== undefined) {
          const { data: dailyStats } = await supabase
            .from('daily_usage_stats')
            .select('ask_count')
            .eq('user_id', userId)
            .eq('date', today)
            .single()

          const currentDailyAsks = dailyStats?.ask_count || 0
          if (currentDailyAsks >= limits.maxDailyAsks) {
            return {
              allowed: false,
              reason: `Daily question limit reached (${currentDailyAsks}/${limits.maxDailyAsks}). Upgrade your plan for more questions.`
            }
          }
        }

        // Check monthly limit
        if (limits.maxMonthlyAsks !== null && limits.maxMonthlyAsks !== undefined) {
          const monthStart = new Date()
          monthStart.setDate(1)
          const monthStartStr = monthStart.toISOString().split('T')[0]

          const { data: monthlyStats } = await supabase
            .from('daily_usage_stats')
            .select('ask_count')
            .eq('user_id', userId)
            .gte('date', monthStartStr)

          const currentMonthlyAsks = monthlyStats?.reduce((sum, day) => sum + day.ask_count, 0) || 0
          if (currentMonthlyAsks >= limits.maxMonthlyAsks) {
            return {
              allowed: false,
              reason: `Monthly question limit reached (${currentMonthlyAsks}/${limits.maxMonthlyAsks}). Your limit resets next month.`
            }
          }
        }
      }

      if (usageType === 'document_upload' && !limits.documentUploadEnabled) {
        return {
          allowed: false,
          reason: 'Document uploads are not available on your current plan. Upgrade to upload repair manuals.'
        }
      }

      return { allowed: true }
    } catch (error) {
      console.error('Error checking usage limit:', error)
      return { allowed: false, reason: 'Error checking usage limits' }
    }
  }

  async getUsageStats(userId: string): Promise<UsageStats> {
    try {
      const tier = await this.getUserTier(userId)
      const limits = TIER_LIMITS[tier]
      const today = new Date().toISOString().split('T')[0]

      // Get today's stats
      const { data: dailyStats } = await supabase
        .from('daily_usage_stats')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .single()

      // Get monthly stats
      const monthStart = new Date()
      monthStart.setDate(1)
      const monthStartStr = monthStart.toISOString().split('T')[0]

      const { data: monthlyData } = await supabase
        .from('daily_usage_stats')
        .select('*')
        .eq('user_id', userId)
        .gte('date', monthStartStr)

      const monthlyStats = monthlyData?.reduce(
        (acc, day) => ({
          ask_count: acc.ask_count + day.ask_count,
          document_upload_count: acc.document_upload_count + day.document_upload_count,
          tts_count: acc.tts_count + day.tts_count,
          stt_count: acc.stt_count + day.stt_count,
          total_cost_cents: acc.total_cost_cents + day.total_cost_cents,
        }),
        { ask_count: 0, document_upload_count: 0, tts_count: 0, stt_count: 0, total_cost_cents: 0 }
      ) || { ask_count: 0, document_upload_count: 0, tts_count: 0, stt_count: 0, total_cost_cents: 0 }

      return {
        daily: {
          ask_count: dailyStats?.ask_count || 0,
          document_upload_count: dailyStats?.document_upload_count || 0,
          tts_count: dailyStats?.tts_count || 0,
          stt_count: dailyStats?.stt_count || 0,
          total_cost_cents: dailyStats?.total_cost_cents || 0,
        },
        monthly: monthlyStats,
        limits: {
          maxDailyAsks: limits.maxDailyAsks || undefined,
          maxMonthlyAsks: limits.maxMonthlyAsks || undefined,
          maxDocumentUploads: limits.maxDocumentUploads || undefined,
          maxVehicles: limits.maxVehicles || undefined,
          maxStorageMB: limits.maxStorageMB || undefined,
        },
      }
    } catch (error) {
      console.error('Error getting usage stats:', error)
      return {
        daily: { ask_count: 0, document_upload_count: 0, tts_count: 0, stt_count: 0, total_cost_cents: 0 },
        monthly: { ask_count: 0, document_upload_count: 0, tts_count: 0, stt_count: 0, total_cost_cents: 0 },
        limits: {},
      }
    }
  }

  async logQuery(userId: string, question: string, response: string, vehicleContext?: Record<string, unknown>, responseTimeMs?: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('query_logs')
        .insert({
          user_id: userId,
          question,
          response,
          vehicle_context: vehicleContext || null,
          response_time_ms: responseTimeMs,
        })

      if (error) {
        console.error('Error logging query:', error)
      }
    } catch (error) {
      console.error('Error in logQuery:', error)
    }
  }
}

export const userService = new UserService()

import { createClient } from '@supabase/supabase-js'
import { Database } from '../supabase/types'
import { TIER_LIMITS, UserTier } from '../config'

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

export interface DowngradeAnalysis {
  vehiclesOverLimit: number
  documentsOverLimit: number
  actionRequired: boolean
  vehiclesToDeactivate: string[]
  documentsToDeactivate: string[]
  warnings: string[]
}

export interface DowngradeOptions {
  keepFavoriteVehicles?: boolean
  keepRecentVehicles?: boolean
  notifyUser?: boolean
}

export class DowngradeService {

  /**
   * Analyze what would happen if user downgrades to a specific tier
   */
  async analyzeDowngrade(userId: string, newTier: UserTier): Promise<DowngradeAnalysis> {
    const limits = TIER_LIMITS[newTier]

    // Get current vehicles
    const { data: vehicles } = await supabase
      .from('vehicles')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('last_used_at', { ascending: false, nullsFirst: false })

    // Get current documents
    const { data: documents } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'inactive')
      .order('created_at', { ascending: false })

    const currentVehicles = vehicles?.length || 0
    const currentDocuments = documents?.length || 0

    const vehiclesOverLimit = limits.maxVehicles !== null ?
      Math.max(0, currentVehicles - limits.maxVehicles) : 0

    const documentsOverLimit = limits.maxDocumentUploads !== null ?
      Math.max(0, currentDocuments - limits.maxDocumentUploads) : 0

    const warnings: string[] = []
    const vehiclesToDeactivate: string[] = []
    const documentsToDeactivate: string[] = []

    if (vehiclesOverLimit > 0) {
      // Select vehicles to deactivate (keep most recently used)
      const excessVehicles = vehicles?.slice(limits.maxVehicles!) || []
      vehiclesToDeactivate.push(...excessVehicles.map(v => v.id))
      warnings.push(`${vehiclesOverLimit} vehicles will become read-only`)
    }

    if (documentsOverLimit > 0) {
      if (limits.maxDocumentUploads === 0) {
        // Free tier - all docs become inaccessible
        documentsToDeactivate.push(...(documents?.map(d => d.id) || []))
        warnings.push('All documents will become inaccessible')
      } else {
        // Keep most recent docs within limit
        const excessDocs = documents?.slice(limits.maxDocumentUploads!) || []
        documentsToDeactivate.push(...excessDocs.map(d => d.id))
        warnings.push(`${documentsOverLimit} documents will become inaccessible`)
      }
    }

    return {
      vehiclesOverLimit,
      documentsOverLimit,
      actionRequired: vehiclesOverLimit > 0 || documentsOverLimit > 0,
      vehiclesToDeactivate,
      documentsToDeactivate,
      warnings
    }
  }

  /**
   * Execute tier downgrade with soft restrictions
   */
  async executeDowngrade(
    userId: string,
    newTier: UserTier,
    options: DowngradeOptions = {}
  ): Promise<void> {
    const analysis = await this.analyzeDowngrade(userId, newTier)

    if (!analysis.actionRequired) {
      return // No action needed
    }

    // Mark excess vehicles as inactive (but don't delete)
    if (analysis.vehiclesToDeactivate.length > 0) {
      await supabase
        .from('vehicles')
        .update({
          is_active: false,
          deactivated_at: new Date().toISOString(),
          deactivation_reason: 'tier_downgrade'
        })
        .in('id', analysis.vehiclesToDeactivate)
    }

        // Mark excess documents as inactive (but don't delete files)
    if (analysis.documentsToDeactivate.length > 0) {
      await supabase
        .from('documents')
        .update({
          status: 'inactive',
          deactivated_at: new Date().toISOString(),
          deactivation_reason: 'tier_downgrade'
        })
        .in('id', analysis.documentsToDeactivate)
    }

    // Log the downgrade action
    await supabase
      .from('user_activity_log')
      .insert({
        user_id: userId,
        action: 'tier_downgrade',
        details: {
          new_tier: newTier,
          vehicles_deactivated: analysis.vehiclesToDeactivate.length,
          documents_deactivated: analysis.documentsToDeactivate.length,
          analysis
        }
      })

    // Send notification if requested
    if (options.notifyUser) {
      await this.notifyUserOfDowngrade(userId, analysis)
    }
  }

  /**
   * Restore access when user upgrades again
   */
  async restoreAccess(userId: string, newTier: UserTier): Promise<void> {
    const limits = TIER_LIMITS[newTier]

    // Reactivate vehicles up to new limit
    if (limits.maxVehicles === null) {
      // Unlimited - restore all
      await supabase
        .from('vehicles')
        .update({
          is_active: true,
          deactivated_at: null,
          deactivation_reason: null
        })
        .eq('user_id', userId)
        .eq('deactivation_reason', 'tier_downgrade')
    } else {
      // Limited - restore up to limit (most recently used first)
      const { data: inactiveVehicles } = await supabase
        .from('vehicles')
        .select('id')
        .eq('user_id', userId)
        .eq('deactivation_reason', 'tier_downgrade')
        .order('last_used_at', { ascending: false, nullsFirst: false })
        .limit(limits.maxVehicles)

      if (inactiveVehicles?.length) {
        await supabase
          .from('vehicles')
          .update({
            is_active: true,
            deactivated_at: null,
            deactivation_reason: null
          })
          .in('id', inactiveVehicles.map(v => v.id))
      }
    }

        // Reactivate documents up to new limit
    if (limits.maxDocumentUploads === null) {
      // Unlimited - restore all
      await supabase
        .from('documents')
        .update({
          status: 'uploaded',
          deactivated_at: null,
          deactivation_reason: null
        })
        .eq('user_id', userId)
        .eq('deactivation_reason', 'tier_downgrade')
    } else if (limits.maxDocumentUploads > 0) {
      // Limited - restore up to limit (most recent first)
      const { data: inactiveDocs } = await supabase
        .from('documents')
        .select('id')
        .eq('user_id', userId)
        .eq('deactivation_reason', 'tier_downgrade')
        .order('created_at', { ascending: false })
        .limit(limits.maxDocumentUploads)

      if (inactiveDocs?.length) {
        await supabase
          .from('documents')
          .update({
            status: 'uploaded',
            deactivated_at: null,
            deactivation_reason: null
          })
          .in('id', inactiveDocs.map(d => d.id))
      }
    }
  }

  private async notifyUserOfDowngrade(userId: string, analysis: DowngradeAnalysis): Promise<void> {
    // Create in-app notification (will be created by the migration)
    try {
      await supabase
        .from('user_notifications')
        .insert({
          user_id: userId,
          type: 'tier_downgrade',
          title: 'Subscription Downgraded',
          message: `Your plan has been downgraded. ${analysis.warnings.join('. ')}. You can upgrade anytime to restore full access.`,
          data: { analysis }
        })
    } catch (error) {
      console.error('Failed to create notification:', error)
      // Don't throw - notification failure shouldn't block downgrade
    }
  }
}

export const downgradeService = new DowngradeService()

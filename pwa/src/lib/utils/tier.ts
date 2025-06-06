/**
 * Converts a tier key to a user-friendly display name
 */
export function getTierDisplayName(tier: string): string {
  switch (tier) {
    case 'free_tier':
    case 'garage_visitor':
      return 'Free'
    case 'weekend_warrior':
      return 'Weekend Warrior'
    case 'gearhead':
      return 'Gearhead'
    case 'master_tech':
      return 'Master Tech'
    case 'free':
      return 'Free'
    case 'pro':
      return 'Pro'
    case 'premium':
      return 'Premium'
    default:
      // Transform snake_case to Title Case as fallback
      return tier.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }
}

/**
 * Check if a tier is a free tier
 */
export function isFreeTier(tier: string): boolean {
  return tier === 'free_tier' || tier === 'garage_visitor' || tier === 'free'
}

/**
 * Check if a tier is a premium tier
 */
export function isPremiumTier(tier: string): boolean {
  return tier === 'master_tech' || tier === 'premium'
}

export interface QuotaStatus {
  used: number
  // null means unlimited (paid tiers) — Infinity does not survive JSON.
  limit: number | null
  remaining: number | null
  resetDate: string
}

export type SubscriptionTier = 'free' | 'premium' | 'enterprise'

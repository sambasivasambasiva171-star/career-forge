/**
 * Freemium quota enforcement.
 *
 * Free tier: 3 CV generations per calendar month, then blocked.
 * Paid tier: unlimited.
 *
 * Quota resets on the first day of each calendar month (UTC).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface QuotaResult {
  used: number
  limit: number
  remaining: number
  isExhausted: boolean
  resetDate: Date
  canGenerate: boolean
}

/**
 * Get the start of the current month (UTC, midnight on first day).
 */
export function getCurrentMonthStart(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

/**
 * Get the start of the next calendar month (UTC) — used as the exclusive
 * upper bound for "this month" queries and as the quota reset date.
 */
function getNextMonthStart(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
}

/**
 * Count CV generations for a user in the current calendar month.
 */
export async function countUsageThisMonth(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const monthStart = getCurrentMonthStart()
  const nextMonthStart = getNextMonthStart()

  const { count, error } = await supabase
    .from('generated_documents')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('doc_type', 'resume')
    .gte('created_at', monthStart.toISOString())
    .lt('created_at', nextMonthStart.toISOString())

  if (error) {
    console.error('Failed to count usage:', error)
    throw new Error('Failed to check usage quota')
  }

  return count ?? 0
}

/**
 * Check quota status for a user.
 */
export async function checkQuota(
  supabase: SupabaseClient,
  userId: string,
  tierType: 'free' | 'premium' | 'enterprise'
): Promise<QuotaResult> {
  // Paid tiers have unlimited quota
  if (tierType !== 'free') {
    return {
      used: 0,
      limit: Infinity,
      remaining: Infinity,
      isExhausted: false,
      resetDate: getNextMonthStart(),
      canGenerate: true,
    }
  }

  // Free tier: 3 per month
  const FREE_LIMIT = 3
  const used = await countUsageThisMonth(supabase, userId)
  const remaining = Math.max(0, FREE_LIMIT - used)
  const isExhausted = used >= FREE_LIMIT
  const resetDate = getNextMonthStart()

  return {
    used,
    limit: FREE_LIMIT,
    remaining,
    isExhausted,
    resetDate,
    canGenerate: remaining > 0,
  }
}

/**
 * Count resume uploads (parse requests) a user has submitted in the last
 * rolling hour. Used to rate-limit free-tier uploads independently of the
 * IP-based Redis limiter in middleware.ts, which caps by IP, not by user.
 */
export async function countUserUploadsThisHour(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

  const { count, error } = await supabase
    .from('resumes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', oneHourAgo.toISOString())

  if (error) {
    console.error('Failed to count uploads:', error)
    return 0 // Fail open: an upload should not be blocked by a counting error
  }

  return count ?? 0
}

/**
 * Reset all free-tier usage counts at the start of each month.
 *
 * No-op by design: quota is date-based (countUsageThisMonth filters on
 * created_at >= month start), so usage automatically falls out of the
 * window on the 1st of each month without a scheduled job.
 */
export async function resetMonthlyQuotas(): Promise<{ reset: number }> {
  return { reset: 0 }
}

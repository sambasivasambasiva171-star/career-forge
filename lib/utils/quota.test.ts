import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getCurrentMonthStart,
  checkQuota,
  countUsageThisMonth,
  countUserUploadsThisHour,
} from '@/lib/utils/quota'

/**
 * Minimal thenable query-builder stub. quota.ts awaits the builder chain
 * directly (no .single()/.maybeSingle()), which relies on Supabase's
 * PromiseLike query builders — this mock implements just that `.then`.
 */
function mockCountResult(result: { count?: number | null; error?: unknown }): SupabaseClient {
  const builder: PromiseLike<typeof result> & Record<string, unknown> = {
    eq: () => builder,
    gte: () => builder,
    lt: () => builder,
    then: (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected),
  }
  return {
    from: () => ({ select: () => builder }),
  } as unknown as SupabaseClient
}

describe('Quota Utilities', () => {
  it('getCurrentMonthStart returns first day of month at UTC midnight', () => {
    const start = getCurrentMonthStart()
    expect(start.getUTCDate()).toBe(1)
    expect(start.getUTCHours()).toBe(0)
    expect(start.getUTCMinutes()).toBe(0)
  })
})

describe('countUsageThisMonth', () => {
  it('returns the count reported by the database', async () => {
    const supabase = mockCountResult({ count: 2, error: null })
    await expect(countUsageThisMonth(supabase, 'user-123')).resolves.toBe(2)
  })

  it('treats a null count as zero', async () => {
    const supabase = mockCountResult({ count: null, error: null })
    await expect(countUsageThisMonth(supabase, 'user-123')).resolves.toBe(0)
  })

  it('throws when the database reports an error (fail closed on quota reads)', async () => {
    const supabase = mockCountResult({ error: { message: 'connection reset' } })
    await expect(countUsageThisMonth(supabase, 'user-123')).rejects.toThrow('Failed to check usage quota')
  })
})

describe('countUserUploadsThisHour', () => {
  it('returns the count reported by the database', async () => {
    const supabase = mockCountResult({ count: 4, error: null })
    await expect(countUserUploadsThisHour(supabase, 'user-123')).resolves.toBe(4)
  })

  it('fails open (returns 0) when the count query errors', async () => {
    const supabase = mockCountResult({ error: { message: 'connection reset' } })
    await expect(countUserUploadsThisHour(supabase, 'user-123')).resolves.toBe(0)
  })
})

describe('checkQuota', () => {
  it('blocks a free-tier user once usage reaches the limit (3/3)', async () => {
    const supabase = mockCountResult({ count: 3, error: null })
    const quota = await checkQuota(supabase, 'user-123', 'free')
    expect(quota.used).toBe(3)
    expect(quota.limit).toBe(3)
    expect(quota.remaining).toBe(0)
    expect(quota.isExhausted).toBe(true)
    expect(quota.canGenerate).toBe(false)
  })

  it('allows a free-tier user under the limit (1/3)', async () => {
    const supabase = mockCountResult({ count: 1, error: null })
    const quota = await checkQuota(supabase, 'user-123', 'free')
    expect(quota.remaining).toBe(2)
    expect(quota.isExhausted).toBe(false)
    expect(quota.canGenerate).toBe(true)
  })

  it('never queries usage for a premium user and reports unlimited quota', async () => {
    // A builder that throws if touched — proves paid tiers short-circuit
    // before any database read, per the early return in checkQuota.
    const supabase = {
      from: () => {
        throw new Error('checkQuota must not query usage for non-free tiers')
      },
    } as unknown as SupabaseClient

    const quota = await checkQuota(supabase, 'user-456', 'premium')
    expect(quota.limit).toBe(Infinity)
    expect(quota.remaining).toBe(Infinity)
    expect(quota.canGenerate).toBe(true)
  })

  it('resets on the calendar month boundary', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-31T23:59:00Z'))
    try {
      const supabase = mockCountResult({ count: 3, error: null })
      const quota = await checkQuota(supabase, 'user-123', 'free')
      // resetDate is the 1st of the *next* UTC month from "now"
      expect(quota.resetDate.toISOString()).toBe('2026-08-01T00:00:00.000Z')
    } finally {
      jest.useRealTimers()
    }
  })
})

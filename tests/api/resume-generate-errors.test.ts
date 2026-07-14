/**
 * Error-path tests for POST /api/resume/generate.
 *
 * Covers the security fix that folds "not found" and "belongs to another
 * user" into a single 404 (see app/api/resume/generate/route.ts), plus the
 * 401/402/502 error responses. Supabase and the AI client are mocked —
 * these are unit tests of the route handler's branching, not integration
 * tests against a real database.
 */
import { NextRequest } from 'next/server'

jest.mock('@/lib/supabase/server', () => ({
  createServerClient: jest.fn(),
}))
jest.mock('@/lib/ai/client', () => ({
  getCompletion: jest.fn(),
  parseJsonResponse: jest.fn(),
}))
jest.mock('@/lib/utils/quota', () => ({
  checkQuota: jest.fn(),
}))

import { createServerClient } from '@/lib/supabase/server'
import { getCompletion } from '@/lib/ai/client'
import { checkQuota } from '@/lib/utils/quota'
import { POST } from '@/app/api/resume/generate/route'

const RESUME_ID = '11111111-1111-1111-1111-111111111111'
const JD_ID = '22222222-2222-2222-2222-222222222222'
const OWNER_ID = 'owner-user-id'
const OTHER_USER_ID = 'other-user-id'

type TableRow = Record<string, unknown> | null

function makeSupabase(opts: {
  user: { id: string } | null
  profile?: TableRow
  resume?: TableRow
  jd?: TableRow
  cached?: TableRow
  insertResult?: TableRow
}) {
  const from = (table: string) => {
    const builder = {
      _isInsert: false,
      select() { return builder },
      eq() { return builder },
      order() { return builder },
      limit() { return builder },
      insert() { builder._isInsert = true; return builder },
      async single() {
        if (table === 'profiles') {
          return opts.profile
            ? { data: opts.profile, error: null }
            : { data: null, error: { message: 'no rows' } }
        }
        if (table === 'resumes') {
          return opts.resume
            ? { data: opts.resume, error: null }
            : { data: null, error: { message: 'no rows' } }
        }
        if (table === 'job_descriptions') {
          return opts.jd
            ? { data: opts.jd, error: null }
            : { data: null, error: { message: 'no rows' } }
        }
        if (table === 'generated_documents' && builder._isInsert) {
          return opts.insertResult !== undefined
            ? { data: opts.insertResult, error: opts.insertResult ? null : { message: 'insert failed' } }
            : { data: { id: 'doc-1' }, error: null }
        }
        throw new Error(`unexpected single() call on table "${table}"`)
      },
      async maybeSingle() {
        if (table === 'generated_documents') {
          return { data: opts.cached ?? null, error: null }
        }
        return { data: null, error: null }
      },
    }
    return builder
  }

  return {
    auth: { getUser: async () => ({ data: { user: opts.user } }) },
    from,
  }
}

function makeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest
}

const validBody = { resume_id: RESUME_ID, jd_id: JD_ID }
const parsedResumeJson = { contact: { name: 'Test' }, work_experience: [], skills: [] }

beforeEach(() => {
  jest.clearAllMocks()
})

describe('POST /api/resume/generate — error paths', () => {
  it('returns 401 UNAUTHORIZED when there is no session', async () => {
    ;(createServerClient as jest.Mock).mockResolvedValue(makeSupabase({ user: null }))

    const res = await POST(makeRequest(validBody))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.code).toBe('UNAUTHORIZED')
  })

  it('returns 404 NOT_FOUND (never 403) when the resume does not exist', async () => {
    ;(createServerClient as jest.Mock).mockResolvedValue(
      makeSupabase({
        user: { id: OWNER_ID },
        profile: { persona_type: 'experienced', location: 'US', job_market: 'GLOBAL', subscription_tier: 'free' },
        resume: null,
      })
    )

    const res = await POST(makeRequest(validBody))
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.code).toBe('NOT_FOUND')
    expect(json.error).toBe('Resume not found')
  })

  it('returns 404 NOT_FOUND (not 403) when the resume belongs to a different user', async () => {
    ;(createServerClient as jest.Mock).mockResolvedValue(
      makeSupabase({
        user: { id: OTHER_USER_ID },
        profile: { persona_type: 'experienced', location: 'US', job_market: 'GLOBAL', subscription_tier: 'free' },
        resume: { id: RESUME_ID, user_id: OWNER_ID, parsed_json: parsedResumeJson, validated_additions: [] },
      })
    )

    const res = await POST(makeRequest(validBody))
    const json = await res.json()

    // The security fix: ownership mismatch is indistinguishable from "does
    // not exist" — a prober can't use status codes to enumerate other
    // users' resume IDs.
    expect(res.status).toBe(404)
    expect(json.code).toBe('NOT_FOUND')
    expect(json.error).toBe('Resume not found')
  })

  it('returns 404 NOT_FOUND when the job description belongs to a different user', async () => {
    ;(createServerClient as jest.Mock).mockResolvedValue(
      makeSupabase({
        user: { id: OWNER_ID },
        profile: { persona_type: 'experienced', location: 'US', job_market: 'GLOBAL', subscription_tier: 'free' },
        resume: { id: RESUME_ID, user_id: OWNER_ID, parsed_json: parsedResumeJson, validated_additions: [] },
        jd: { id: JD_ID, user_id: OTHER_USER_ID, raw_text: 'Some JD text' },
      })
    )

    const res = await POST(makeRequest(validBody))
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.code).toBe('NOT_FOUND')
    expect(json.error).toBe('Job description not found')
  })

  it('returns 402 QUOTA_EXHAUSTED when the free tier limit is reached', async () => {
    ;(createServerClient as jest.Mock).mockResolvedValue(
      makeSupabase({
        user: { id: OWNER_ID },
        profile: { persona_type: 'experienced', location: 'US', job_market: 'GLOBAL', subscription_tier: 'free' },
        resume: { id: RESUME_ID, user_id: OWNER_ID, parsed_json: parsedResumeJson, validated_additions: [] },
        jd: { id: JD_ID, user_id: OWNER_ID, raw_text: 'Some JD text' },
        cached: null,
      })
    )
    ;(checkQuota as jest.Mock).mockResolvedValue({
      used: 3,
      limit: 3,
      remaining: 0,
      isExhausted: true,
      canGenerate: false,
      resetDate: new Date('2026-08-01T00:00:00.000Z'),
    })

    const res = await POST(makeRequest(validBody))
    const json = await res.json()

    expect(res.status).toBe(402)
    expect(json.code).toBe('QUOTA_EXHAUSTED')
    expect(json.quota.used).toBe(3)
    expect(getCompletion).not.toHaveBeenCalled()
  })

  it('returns 502 AI_ERROR when the AI call fails', async () => {
    ;(createServerClient as jest.Mock).mockResolvedValue(
      makeSupabase({
        user: { id: OWNER_ID },
        profile: { persona_type: 'experienced', location: 'US', job_market: 'GLOBAL', subscription_tier: 'free' },
        resume: { id: RESUME_ID, user_id: OWNER_ID, parsed_json: parsedResumeJson, validated_additions: [] },
        jd: { id: JD_ID, user_id: OWNER_ID, raw_text: 'Some JD text' },
        cached: null,
      })
    )
    ;(checkQuota as jest.Mock).mockResolvedValue({
      used: 0,
      limit: 3,
      remaining: 3,
      isExhausted: false,
      canGenerate: true,
      resetDate: new Date('2026-08-01T00:00:00.000Z'),
    })
    ;(getCompletion as jest.Mock).mockRejectedValue(new Error('NIM unreachable'))

    const res = await POST(makeRequest(validBody))
    const json = await res.json()

    expect(res.status).toBe(502)
    expect(json.code).toBe('AI_ERROR')
  })

  it('returns a cached variant without calling the AI or checking quota', async () => {
    ;(createServerClient as jest.Mock).mockResolvedValue(
      makeSupabase({
        user: { id: OWNER_ID },
        profile: { persona_type: 'experienced', location: 'US', job_market: 'GLOBAL', subscription_tier: 'free' },
        resume: { id: RESUME_ID, user_id: OWNER_ID, parsed_json: parsedResumeJson, validated_additions: [] },
        jd: { id: JD_ID, user_id: OWNER_ID, raw_text: 'Some JD text' },
        cached: { id: 'cached-doc-1', content_json: { skills: ['python'] } },
      })
    )

    const res = await POST(makeRequest(validBody))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.cached).toBe(true)
    expect(json.document_id).toBe('cached-doc-1')
    expect(checkQuota).not.toHaveBeenCalled()
    expect(getCompletion).not.toHaveBeenCalled()
  })
})

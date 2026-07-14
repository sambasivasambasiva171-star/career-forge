import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCompletion, parseJsonResponse } from '@/lib/ai/client'
import { PREFLIGHT_SYSTEM_PROMPT, buildPreflightUserPrompt } from '@/lib/ai/prompts/preflight'
import { preFlightCheckSchema } from '@/lib/validation/schemas'

interface PreflightResult {
  checks: Array<{ type: string; jd_requirement: string; guidance: string }>
}

/**
 * POST /api/jd/preflight
 *
 * Run a pre-screening check on a job description, surfacing likely
 * screening questions/requirements before the user applies.
 *
 * @body { jd_id: string }
 * @returns 200 { success: true, checks: Array<{ type, jd_requirement, guidance }> }
 * @error 400 INVALID_INPUT
 * @error 401 UNAUTHORIZED
 * @error 404 NOT_FOUND — job description doesn't exist or isn't owned by the caller
 * @error 502 AI_ERROR
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body', code: 'INVALID_INPUT' }, { status: 400 })
  }

  const parsed = preFlightCheckSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 })
  }

  const { jd_id } = parsed.data

  const { data: jd, error: jdError } = await supabase
    .from('job_descriptions')
    .select('id, user_id, raw_text')
    .eq('id', jd_id)
    .single()

  if (jdError || !jd || jd.user_id !== user.id) {
    return NextResponse.json({ error: 'Job description not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('location')
    .eq('id', user.id)
    .single()

  let result: PreflightResult
  try {
    const aiResponse = await getCompletion({
      systemPrompt: PREFLIGHT_SYSTEM_PROMPT,
      userPrompt: buildPreflightUserPrompt(jd.raw_text, profile?.location ?? null),
      temperature: 0.2,
      maxTokens: 1024,
    })

    result = parseJsonResponse<PreflightResult>(aiResponse)
  } catch (err) {
    console.error('Pre-flight check AI error:', err)
    return NextResponse.json({ error: 'Failed to run pre-flight check. Please try again.', code: 'AI_ERROR' }, { status: 502 })
  }

  if (!Array.isArray(result.checks)) {
    console.error('Unexpected pre-flight response shape:', result)
    return NextResponse.json({ error: 'Pre-flight check returned an unexpected format.', code: 'AI_ERROR' }, { status: 502 })
  }

  return NextResponse.json({ success: true, checks: result.checks })
}

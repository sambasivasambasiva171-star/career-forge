import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCompletion, parseJsonResponse } from '@/lib/ai/client'
import { NETWORKING_SYSTEM_PROMPT, buildNetworkingUserPrompt } from '@/lib/ai/prompts/networking'
import { generateNetworkingSchema } from '@/lib/validation/schemas'

interface NetworkingResult {
  suggestions: Array<{ category: 'linkedin' | 'alumni' | 'placement_cell' | 'referral'; suggestion_text: string }>
}

/**
 * POST /api/networking/suggest
 *
 * Generate networking outreach suggestions (LinkedIn, alumni, placement
 * cell, referral) tailored to the user's latest generated resume and a JD.
 *
 * @body { jd_id: string }
 * @returns 200 { success: true, suggestions: Array<{ category, suggestion_text }> }
 * @error 400 INVALID_INPUT — bad body, no persona set, or no resume generated yet
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

  const parsed = generateNetworkingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 })
  }

  const { jd_id } = parsed.data

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('persona_type')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.persona_type) {
    return NextResponse.json({ error: 'User persona not set.', code: 'INVALID_INPUT' }, { status: 400 })
  }

  const { data: jd, error: jdError } = await supabase
    .from('job_descriptions')
    .select('id, user_id, raw_text')
    .eq('id', jd_id)
    .single()

  if (jdError || !jd || jd.user_id !== user.id) {
    return NextResponse.json({ error: 'Job description not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const { data: latestResume, error: docError } = await supabase
    .from('generated_documents')
    .select('id, content_json')
    .eq('user_id', user.id)
    .eq('doc_type', 'resume')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (docError || !latestResume) {
    return NextResponse.json({ error: 'No generated resume found. Please generate your resume first.', code: 'INVALID_INPUT' }, { status: 400 })
  }

  let result: NetworkingResult
  try {
    const aiResponse = await getCompletion({
      systemPrompt: NETWORKING_SYSTEM_PROMPT,
      userPrompt: buildNetworkingUserPrompt(latestResume.content_json, profile.persona_type, jd.raw_text),
      temperature: 0.5,
      maxTokens: 1536,
    })

    result = parseJsonResponse<NetworkingResult>(aiResponse)
  } catch (err) {
    console.error('Networking suggestions AI error:', err)
    return NextResponse.json({ error: 'Failed to generate networking suggestions. Please try again.', code: 'AI_ERROR' }, { status: 502 })
  }

  if (!Array.isArray(result.suggestions)) {
    console.error('Unexpected networking response shape:', result)
    return NextResponse.json({ error: 'Networking suggestions returned an unexpected format.', code: 'AI_ERROR' }, { status: 502 })
  }

  const rows = result.suggestions.map((s) => ({
    user_id: user.id,
    jd_id,
    suggestion_text: s.suggestion_text,
    category: s.category,
  }))

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from('networking_suggestions')
      .insert(rows)

    if (insertError) {
      console.error('Failed to save networking suggestions:', insertError)
    }
  }

  return NextResponse.json({ success: true, suggestions: result.suggestions })
}

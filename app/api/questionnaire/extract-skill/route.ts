import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCompletion, parseJsonResponse } from '@/lib/ai/client'
import { SKILL_EXTRACTION_SYSTEM_PROMPT, buildSkillExtractionUserPrompt } from '@/lib/ai/prompts/questionnaire'
import { extractSkillRewriteSchema } from '@/lib/validation/schemas'

interface SkillExtractionResult {
  skill_identified: string
  rewritten_bullet: string
}

/**
 * POST /api/questionnaire/extract-skill
 *
 * Extract a named skill from a user's free-text answer to a screening
 * question, and rewrite the associated resume bullet to surface it.
 *
 * @body { jd_id: string, existing_bullet: string, question: string, answer: string }
 * @returns 200 { success: true, skill_identified: string, rewritten_bullet: string }
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

  const parsed = extractSkillRewriteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 })
  }

  const { jd_id, existing_bullet, question, answer } = parsed.data

  const { data: jd, error: jdError } = await supabase
    .from('job_descriptions')
    .select('id, user_id')
    .eq('id', jd_id)
    .single()

  if (jdError || !jd || jd.user_id !== user.id) {
    return NextResponse.json({ error: 'Job description not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  let result: SkillExtractionResult
  try {
    const aiResponse = await getCompletion({
      systemPrompt: SKILL_EXTRACTION_SYSTEM_PROMPT,
      userPrompt: buildSkillExtractionUserPrompt(existing_bullet, question, answer),
      temperature: 0.3,
      maxTokens: 256,
    })

    result = parseJsonResponse<SkillExtractionResult>(aiResponse)
  } catch (err) {
    console.error('Skill extraction AI error:', err)
    return NextResponse.json({ error: 'Failed to process your answer. Please try again.', code: 'AI_ERROR' }, { status: 502 })
  }

  if (typeof result.skill_identified !== 'string' || typeof result.rewritten_bullet !== 'string') {
    console.error('Unexpected skill extraction response shape:', result)
    return NextResponse.json({ error: 'Processing returned an unexpected format.', code: 'AI_ERROR' }, { status: 502 })
  }

  const { error: insertError } = await supabase
    .from('questionnaire_responses')
    .insert({
      user_id: user.id,
      jd_id,
      question,
      answer,
      extracted_skill: result.skill_identified,
    })

  if (insertError) {
    console.error('Failed to save questionnaire response:', insertError)
    return NextResponse.json({ error: 'Failed to save your response.', code: 'INTERNAL_ERROR' }, { status: 500 })
  }

  return NextResponse.json({ success: true, ...result })
}

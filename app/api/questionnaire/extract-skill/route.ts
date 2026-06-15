import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCompletion, parseJsonResponse } from '@/lib/ai/client'
import { SKILL_EXTRACTION_SYSTEM_PROMPT, buildSkillExtractionUserPrompt } from '@/lib/ai/prompts/questionnaire'
import { extractSkillRewriteSchema } from '@/lib/validation/schemas'

interface SkillExtractionResult {
  skill_identified: string
  rewritten_bullet: string
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = extractSkillRewriteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { jd_id, existing_bullet, question, answer } = parsed.data

  const { data: jd, error: jdError } = await supabase
    .from('job_descriptions')
    .select('id, user_id')
    .eq('id', jd_id)
    .single()

  if (jdError || !jd) {
    return NextResponse.json({ error: 'Job description not found' }, { status: 404 })
  }

  if (jd.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
    return NextResponse.json({ error: 'Failed to process your answer. Please try again.' }, { status: 502 })
  }

  if (typeof result.skill_identified !== 'string' || typeof result.rewritten_bullet !== 'string') {
    console.error('Unexpected skill extraction response shape:', result)
    return NextResponse.json({ error: 'Processing returned an unexpected format.' }, { status: 502 })
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
    return NextResponse.json({ error: 'Failed to save your response.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, ...result })
}

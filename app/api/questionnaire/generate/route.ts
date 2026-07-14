import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCompletion, parseJsonResponse } from '@/lib/ai/client'
import {
  QUESTIONNAIRE_SYSTEM_PROMPT_EXPERIENCED,
  QUESTIONNAIRE_SYSTEM_PROMPT_FRESHER,
  buildQuestionnaireUserPrompt,
} from '@/lib/ai/prompts/questionnaire'
import { generateQuestionnaireSchema } from '@/lib/validation/schemas'

interface QuestionnaireResult {
  questions: Array<{ id: string; target_skill: string; question_text: string }>
}

/**
 * POST /api/questionnaire/generate
 *
 * Generate screening questions targeting the skill gaps found by
 * /api/jd/analyze, phrased for the user's persona (fresher/experienced).
 *
 * @body { resume_id: string, jd_id: string }
 * @returns 200 { success: true, questions: Array<{ id, target_skill, question_text }>, persona: string }
 * @error 400 INVALID_INPUT — bad body, no persona, resume unparsed, or gap analysis not run yet
 * @error 401 UNAUTHORIZED
 * @error 404 NOT_FOUND — resume or job description doesn't exist or isn't owned by the caller
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

  const parsed = generateQuestionnaireSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 })
  }

  const { resume_id, jd_id } = parsed.data

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('persona_type')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.persona_type) {
    return NextResponse.json({ error: 'User persona not set. Please complete onboarding.', code: 'INVALID_INPUT' }, { status: 400 })
  }

  const { data: resume, error: resumeError } = await supabase
    .from('resumes')
    .select('id, user_id, parsed_json')
    .eq('id', resume_id)
    .single()

  if (resumeError || !resume || resume.user_id !== user.id) {
    return NextResponse.json({ error: 'Resume not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  if (!resume.parsed_json) {
    return NextResponse.json({ error: 'Resume has not been parsed yet.', code: 'INVALID_INPUT' }, { status: 400 })
  }

  const { data: jd, error: jdError } = await supabase
    .from('job_descriptions')
    .select('id, user_id, parsed_keywords')
    .eq('id', jd_id)
    .single()

  if (jdError || !jd || jd.user_id !== user.id) {
    return NextResponse.json({ error: 'Job description not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  if (!jd.parsed_keywords) {
    return NextResponse.json({ error: 'Gap analysis has not been run yet. Please analyze the JD first.', code: 'INVALID_INPUT' }, { status: 400 })
  }

  const skillGaps = jd.parsed_keywords as { missing_skills: unknown[]; partial_skills: unknown[] }

  const systemPrompt =
    profile.persona_type === 'fresher'
      ? QUESTIONNAIRE_SYSTEM_PROMPT_FRESHER
      : QUESTIONNAIRE_SYSTEM_PROMPT_EXPERIENCED

  let result: QuestionnaireResult
  try {
    const aiResponse = await getCompletion({
      systemPrompt,
      userPrompt: buildQuestionnaireUserPrompt(resume.parsed_json, skillGaps),
      temperature: 0.4,
      maxTokens: 2048,
    })

    result = parseJsonResponse<QuestionnaireResult>(aiResponse)
  } catch (err) {
    console.error('Questionnaire generation AI error:', err)
    return NextResponse.json({ error: 'Failed to generate questions. Please try again.', code: 'AI_ERROR' }, { status: 502 })
  }

  if (!Array.isArray(result.questions) || result.questions.length === 0) {
    console.error('Unexpected questionnaire response shape:', result)
    return NextResponse.json({ error: 'Question generation returned an unexpected format.', code: 'AI_ERROR' }, { status: 502 })
  }

  return NextResponse.json({ success: true, questions: result.questions, persona: profile.persona_type })
}

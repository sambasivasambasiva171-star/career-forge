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

  const parsed = generateQuestionnaireSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { resume_id, jd_id } = parsed.data

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('persona_type')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.persona_type) {
    return NextResponse.json({ error: 'User persona not set. Please complete onboarding.' }, { status: 400 })
  }

  const { data: resume, error: resumeError } = await supabase
    .from('resumes')
    .select('id, user_id, parsed_json')
    .eq('id', resume_id)
    .single()

  if (resumeError || !resume) {
    return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
  }

  if (resume.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!resume.parsed_json) {
    return NextResponse.json({ error: 'Resume has not been parsed yet.' }, { status: 400 })
  }

  const { data: jd, error: jdError } = await supabase
    .from('job_descriptions')
    .select('id, user_id, parsed_keywords')
    .eq('id', jd_id)
    .single()

  if (jdError || !jd) {
    return NextResponse.json({ error: 'Job description not found' }, { status: 404 })
  }

  if (jd.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!jd.parsed_keywords) {
    return NextResponse.json({ error: 'Gap analysis has not been run yet. Please analyze the JD first.' }, { status: 400 })
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

    console.log('questionnaire raw AI response:', aiResponse)
    result = parseJsonResponse<QuestionnaireResult>(aiResponse)
  } catch (err) {
    console.error('Questionnaire generation AI error:', err)
    return NextResponse.json({ error: 'Failed to generate questions. Please try again.' }, { status: 502 })
  }

  if (!Array.isArray(result.questions) || result.questions.length === 0) {
    console.error('Unexpected questionnaire response shape:', result)
    return NextResponse.json({ error: 'Question generation returned an unexpected format.' }, { status: 502 })
  }

  return NextResponse.json({ success: true, questions: result.questions, persona: profile.persona_type })
}

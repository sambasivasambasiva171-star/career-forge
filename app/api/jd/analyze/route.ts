import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCompletion, parseJsonResponse } from '@/lib/ai/client'
import { JD_GAP_ANALYSIS_SYSTEM_PROMPT, buildJdGapAnalysisUserPrompt } from '@/lib/ai/prompts/jd-gap-analysis'
import { analyzeGapSchema } from '@/lib/validation/schemas'

interface GapAnalysisResult {
  matched_skills: Array<{ skill: string; evidence: string }>
  missing_skills: Array<{ skill: string; jd_context: string }>
  partial_skills: Array<{ skill: string; resume_evidence: string; jd_requirement: string }>
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

  const parsed = analyzeGapSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { resume_id, jd_id } = parsed.data

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
    return NextResponse.json(
      { error: 'Resume has not been parsed yet. Please parse it first.' },
      { status: 400 }
    )
  }

  const { data: jd, error: jdError } = await supabase
    .from('job_descriptions')
    .select('id, user_id, raw_text')
    .eq('id', jd_id)
    .single()

  if (jdError || !jd) {
    return NextResponse.json({ error: 'Job description not found' }, { status: 404 })
  }

  if (jd.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let gapResult: GapAnalysisResult
  try {
    const aiResponse = await getCompletion({
      systemPrompt: JD_GAP_ANALYSIS_SYSTEM_PROMPT,
      userPrompt: buildJdGapAnalysisUserPrompt(resume.parsed_json, jd.raw_text),
      temperature: 0.2,
      maxTokens: 2048,
    })

    gapResult = parseJsonResponse<GapAnalysisResult>(aiResponse)
  } catch (err) {
    console.error('JD gap analysis AI error:', err)
    return NextResponse.json({ error: 'Failed to analyze job description. Please try again.' }, { status: 502 })
  }

  if (
    !Array.isArray(gapResult.matched_skills) ||
    !Array.isArray(gapResult.missing_skills) ||
    !Array.isArray(gapResult.partial_skills)
  ) {
    console.error('Unexpected gap analysis response shape:', gapResult)
    return NextResponse.json({ error: 'Gap analysis returned an unexpected format.' }, { status: 502 })
  }

  const { error: jdUpdateError } = await supabase
    .from('job_descriptions')
    .update({ parsed_keywords: gapResult })
    .eq('id', jd_id)

  if (jdUpdateError) {
    console.error('Failed to save gap analysis to job_descriptions:', jdUpdateError)
  }

  const skillGapRows = [
    ...gapResult.missing_skills.map((s) => ({
      user_id: user.id,
      jd_id,
      skill_name: s.skill,
      status: 'identified' as const,
    })),
    ...gapResult.partial_skills.map((s) => ({
      user_id: user.id,
      jd_id,
      skill_name: s.skill,
      status: 'identified' as const,
    })),
  ]

  if (skillGapRows.length > 0) {
    const { error: insertError } = await supabase
      .from('skill_gaps')
      .insert(skillGapRows)

    if (insertError) {
      console.error('Failed to insert skill gaps:', insertError)
      return NextResponse.json({ error: 'Failed to save skill gap analysis.' }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, analysis: gapResult })
}

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCompletion, parseJsonResponse } from '@/lib/ai/client'
import { generateResumeSchema } from '@/lib/validation/schemas'
import {
  computeCvDiff,
  describeChanges,
  COMMON_QUESTION_TYPES,
  INTERVIEW_DAY_CHECKLIST,
  type ResumeSnapshot,
} from '@/lib/utils/interview-guidance-template'
import { detectCompetitiveAdvantages } from '@/lib/utils/competitive-advantages'

/**
 * POST /api/resume/interview-guidance
 *
 * Explains what actually changed between the user's original resume and
 * their AI-tailored CV for a specific job description, and why — so the
 * user understands their own generated CV well enough to speak to it
 * confidently in an interview, rather than being surprised by wording
 * they didn't choose. Every "what changed" is a deterministic diff of the
 * two real documents (lib/utils/interview-guidance-template.ts); only the
 * "why" text is AI-written, and it is grounded in that same real diff
 * plus the real job description — never given room to invent a change
 * that didn't happen.
 *
 * @body { resume_id: string, jd_id: string, cv_document_id: string }
 * @returns 200 { success: true, cv_changes, strengths_to_emphasize, common_question_types, interview_day_checklist }
 * @error 400 INVALID_INPUT
 * @error 401 UNAUTHORIZED
 * @error 404 NOT_FOUND — resume, job description, or generated CV doesn't exist or isn't owned by the caller
 * @error 500 INTERNAL_ERROR
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body', code: 'INVALID_INPUT' }, { status: 400 })
    }

    const parsed = generateResumeSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 })
    }
    const { resume_id, jd_id, cv_document_id } = parsed.data

    const [resumeResult, jdResult, docResult] = await Promise.all([
      supabase.from('resumes').select('parsed_json').eq('id', resume_id).eq('user_id', user.id).single(),
      supabase.from('job_descriptions').select('raw_text').eq('id', jd_id).eq('user_id', user.id).single(),
      supabase
        .from('generated_documents')
        .select('content_json')
        .eq('id', cv_document_id)
        .eq('user_id', user.id)
        .eq('doc_type', 'resume')
        .single(),
    ])

    if (!resumeResult.data || !jdResult.data || !docResult.data) {
      return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    const original = toSnapshot(resumeResult.data.parsed_json)
    const tailored = toSnapshot(docResult.data.content_json)
    const jdText = jdResult.data.raw_text || ''

    const diff = computeCvDiff(original, tailored)
    const changeDescriptions = describeChanges(diff)
    const reasons = await generateChangeReasons(changeDescriptions, jdText)

    const cv_changes = changeDescriptions.map((item, i) => ({
      section: item.section,
      what_changed: item.what_changed,
      why: reasons[i] ?? 'This aligns your CV more closely with the job description.',
    }))

    const cvText = JSON.stringify(docResult.data.content_json || {})
    const strengths_to_emphasize = detectCompetitiveAdvantages(cvText, jdText)

    return NextResponse.json({
      success: true,
      cv_changes,
      strengths_to_emphasize,
      common_question_types: COMMON_QUESTION_TYPES,
      interview_day_checklist: INTERVIEW_DAY_CHECKLIST,
    })
  } catch (error) {
    console.error('[INTERVIEW_GUIDANCE]', error)
    return NextResponse.json({ error: 'Failed to generate interview guidance.', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

function toSnapshot(json: unknown): ResumeSnapshot {
  const data = (json || {}) as {
    summary?: string | null
    skills?: string[]
    work_experience?: Array<{ title?: string; company?: string; responsibilities?: string[] }>
  }
  return {
    summary: data.summary ?? null,
    skills: Array.isArray(data.skills) ? data.skills : [],
    work_experience: Array.isArray(data.work_experience)
      ? data.work_experience.map(exp => ({
          title: exp.title ?? '',
          company: exp.company ?? '',
          responsibilities: Array.isArray(exp.responsibilities) ? exp.responsibilities : [],
        }))
      : [],
  }
}

/**
 * Asks the AI to explain, in one short sentence each, why every already-
 * identified real change helps against the real job description. The AI
 * is given the exact before/after text and the exact JD text — its job is
 * narrowly to connect the two, not to describe what changed (already
 * known) or invent anything new. Falls back to a generic-but-honest
 * reason per item if the AI call fails or returns the wrong shape, so a
 * transient AI hiccup never blocks the rest of the report.
 */
async function generateChangeReasons(
  changes: Array<{ section: string; what_changed: string; before: string; after: string }>,
  jdText: string
): Promise<string[]> {
  const fallback = changes.map(() => 'This aligns your CV more closely with the job description.')
  if (changes.length === 0) return []

  const systemPrompt =
    'You explain, in plain English, why specific real resume edits help match a specific real job ' +
    'description. You are given the exact before/after text for each edit and the exact job description ' +
    "text — reference only what's actually there. Never invent an employer, achievement, or skill not " +
    'present in the input. Respond with a JSON array of strings, exactly one per edit, in the same order, ' +
    'each under 30 words. No other text.'

  const userPrompt = `Job description:\n${jdText}\n\nEdits made to the CV:\n${changes
    .map((c, i) => `${i + 1}. [${c.section}] ${c.what_changed}\nBefore: ${c.before}\nAfter: ${c.after}`)
    .join('\n\n')}`

  try {
    const response = await getCompletion({
      systemPrompt,
      userPrompt,
      temperature: 0.2,
      maxTokens: 800,
    })
    const reasons = parseJsonResponse<string[]>(response)
    if (Array.isArray(reasons) && reasons.length === changes.length) {
      return reasons
    }
    console.error('[INTERVIEW_GUIDANCE] AI returned unexpected shape, using fallback reasons')
    return fallback
  } catch (err) {
    console.error('[INTERVIEW_GUIDANCE_AI]', err)
    return fallback
  }
}

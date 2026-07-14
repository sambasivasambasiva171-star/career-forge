import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCompletion, parseJsonResponse } from '@/lib/ai/client'
import { RESUME_GENERATE_SYSTEM_PROMPT, buildResumeGenerateUserPrompt } from '@/lib/ai/prompts/resume-generate'
import { generateResumeWithFactsSchema } from '@/lib/validation/schemas'
import { deriveLanguageVariant, deriveDocumentTitle } from '@/lib/utils/location'
import { applyUKSpellingDeep, isUKMarket } from '@/lib/utils/spelling'
import { filterSkills, extractJDKeywords } from '@/lib/utils/skills'
import { normaliseDates, truncateSummary, removeIrrelevantRoles, capBullets } from '@/lib/utils/cv-postprocess'
import { factCheckResume } from '@/lib/utils/fact-check'
import { computeMatchScore, normalizeCVForKeywordMatch } from '@/lib/utils/keyword-score'

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

  const parsed = generateResumeWithFactsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { resume_id, jd_id, preflight_facts, questionnaire_skipped, regenerate } = parsed.data

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('persona_type, location, job_market')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.persona_type) {
    return NextResponse.json({ error: 'User persona not set.' }, { status: 400 })
  }

  const { data: resume, error: resumeError } = await supabase
    .from('resumes')
    .select('id, user_id, parsed_json, validated_additions')
    .eq('id', resume_id)
    .single()

  if (resumeError || !resume) {
    return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
  }

  if (resume.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsedJson = resume.parsed_json as Record<string, unknown>
  const isActuallyParsed = parsedJson &&
    parsedJson.contact !== undefined &&
    parsedJson.work_experience !== undefined

  if (!isActuallyParsed) {
    return NextResponse.json({
      error: 'Resume is still being processed. Please wait a moment and try again.',
      code: 'RESUME_NOT_PARSED'
    }, { status: 422 })
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

  // Determinism guarantee, part 1: a resume+JD pair has ONE tailored CV.
  // Unless the user explicitly asks to regenerate, return the saved variant
  // instead of rolling the dice again.
  if (!regenerate) {
    const { data: existing } = await supabase
      .from('generated_documents')
      .select('id, content_json')
      .eq('user_id', user.id)
      .eq('resume_id', resume_id)
      .eq('jd_id', jd_id)
      .eq('doc_type', 'resume')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({
        success: true,
        resume: existing.content_json,
        document_id: existing.id,
        cached: true,
      })
    }
  }

  const validatedAdditions = Array.isArray(resume.validated_additions) ? resume.validated_additions : []
  /**
   * job_market enum values:
   *   'GB'     → UK English (enforceUKSpelling applied)
   *   'IN'     → US English (India / international)
   *   'GLOBAL' → US English (fallback)
   * Do NOT use 'UK', 'US', or any other string — they will silently
   * fall through to US English without warning.
   */
  const languageVariant = isUKMarket(profile.job_market)
    ? 'uk_english'
    : profile.job_market === 'IN' || profile.job_market === 'GLOBAL'
    ? 'us_english'
    : deriveLanguageVariant(profile.location)

  let finalResume: object
  try {
    const aiResponse = await getCompletion({
      systemPrompt: RESUME_GENERATE_SYSTEM_PROMPT,
      userPrompt: buildResumeGenerateUserPrompt(resume.parsed_json, validatedAdditions, jd.raw_text, profile.persona_type, languageVariant, preflight_facts),
      temperature: 0,
      seed: parseInt(process.env.RESUME_GENERATION_SEED ?? '42', 10),
      maxTokens: 3072,
    })

    finalResume = parseJsonResponse<object>(aiResponse)
    if (languageVariant === 'uk_english') {
      finalResume = applyUKSpellingDeep(finalResume)
    }

    const rawSkills = (finalResume as { skills?: string[] }).skills || []
    let processedSkills = filterSkills(rawSkills, jd.raw_text)

    if (processedSkills.length < 6) {
      const jdKeywords = extractJDKeywords(jd.raw_text)
      const existing = new Set(processedSkills.map((s: string) => s.toLowerCase()))
      const toAdd = jdKeywords
        .filter((k: string) => !existing.has(k.toLowerCase()))
        .filter((k: string) => filterSkills([k], jd.raw_text).length > 0)
        .slice(0, 8 - processedSkills.length)
      processedSkills = [...processedSkills, ...toAdd]
    }

    finalResume = { ...finalResume, skills: processedSkills }

    finalResume = normaliseDates(finalResume as Record<string, unknown>) as typeof finalResume
    finalResume = truncateSummary(finalResume as Record<string, unknown>) as typeof finalResume
    finalResume = removeIrrelevantRoles(finalResume as Record<string, unknown>, jd.raw_text) as typeof finalResume
    finalResume = capBullets(finalResume as Record<string, unknown>) as typeof finalResume

    // Anti-hallucination fact gate: strip any role, education entry, or
    // certification not grounded in the candidate's actual source data.
    const factCheck = factCheckResume(
      finalResume as Record<string, unknown>,
      resume.parsed_json,
      validatedAdditions,
      preflight_facts
    )
    if (factCheck.removed.length > 0) {
      console.warn('[FACT GATE] Removed fabricated content:', factCheck.removed)
    }
    finalResume = factCheck.cv
  } catch (err) {
    console.error('Resume generation AI error:', err)
    return NextResponse.json({ error: 'Failed to generate final resume. Please try again.' }, { status: 502 })
  }

  // ATS keyword match score — the same number an ATS sorts candidates by.
  const cvNormalizedText = normalizeCVForKeywordMatch(finalResume)
  const matchScore = computeMatchScore(cvNormalizedText, jd.raw_text)

  const { data: insertedDoc, error: insertError } = await supabase
    .from('generated_documents')
    .insert({
      user_id: user.id,
      resume_id,
      jd_id,
      doc_type: 'resume',
      content_json: { ...finalResume, document_title: deriveDocumentTitle(languageVariant), language_variant: languageVariant, questionnaire_skipped, match_score: matchScore.score, match_missing_keywords: matchScore.missing },
    })
    .select('id')
    .single()

  if (insertError || !insertedDoc) {
    console.error('Failed to save generated resume:', insertError)
    return NextResponse.json({ error: 'Failed to save generated resume.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, resume: finalResume, document_id: insertedDoc.id, match_score: matchScore.score, match_missing_keywords: matchScore.missing })
}

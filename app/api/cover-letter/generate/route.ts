import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCompletion, parseJsonResponse } from '@/lib/ai/client'
import { COVER_LETTER_SYSTEM_PROMPT, buildCoverLetterUserPrompt } from '@/lib/ai/prompts/resume-generate'
import { generateResumeSchema } from '@/lib/validation/schemas'
import { deriveLanguageVariant } from '@/lib/utils/location'
import { isUKMarket, enforceUKSpelling } from '@/lib/utils/spelling'

interface CoverLetterResult {
  cover_letter_text: string
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

  const parsed = generateResumeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { resume_id, jd_id, cv_document_id } = parsed.data

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

  const { data: resumeDoc, error: docError } = await supabase
    .from('generated_documents')
    .select('id, content_json')
    .eq('id', cv_document_id)
    .eq('user_id', user.id)
    .eq('doc_type', 'resume')
    .single()

  if (docError || !resumeDoc) {
    return NextResponse.json({ error: 'Source resume not found' }, { status: 404 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('location, job_market, persona_type')
    .eq('id', user.id)
    .single()

  const languageVariant = isUKMarket(profile?.job_market) ? 'uk_english' : deriveLanguageVariant(profile?.location ?? null)

  let result: CoverLetterResult
  try {
    const aiResponse = await getCompletion({
      systemPrompt: COVER_LETTER_SYSTEM_PROMPT,
      userPrompt: buildCoverLetterUserPrompt(resumeDoc.content_json, jd.raw_text, languageVariant, profile?.persona_type),
      temperature: 0.4,
      maxTokens: 1024,
    })

    result = parseJsonResponse<CoverLetterResult>(aiResponse)
  } catch (err) {
    console.error('Cover letter AI error:', err)
    return NextResponse.json({ error: 'Failed to generate cover letter. Please try again.' }, { status: 502 })
  }

  if (typeof result.cover_letter_text !== 'string') {
    console.error('Unexpected cover letter response shape:', result)
    return NextResponse.json({ error: 'Cover letter generation returned an unexpected format.' }, { status: 502 })
  }

  const rawCoverLetter = result.cover_letter_text
  const coverLetterText = isUKMarket(profile?.job_market)
    ? enforceUKSpelling(rawCoverLetter)
    : rawCoverLetter

  const { data: insertedDoc, error: insertError } = await supabase
    .from('generated_documents')
    .insert({
      user_id: user.id,
      resume_id,
      jd_id,
      doc_type: 'cover_letter',
      content_json: { cover_letter_text: coverLetterText },
    })
    .select('id')
    .single()

  if (insertError || !insertedDoc) {
    console.error('Failed to save cover letter:', insertError)
    return NextResponse.json({ error: 'Failed to save cover letter.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, cover_letter_text: coverLetterText, document_id: insertedDoc.id })
}

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCompletion, parseJsonResponse } from '@/lib/ai/client'
import { RESUME_GENERATE_SYSTEM_PROMPT, buildResumeGenerateUserPrompt } from '@/lib/ai/prompts/resume-generate'
import { generateResumeSchema } from '@/lib/validation/schemas'
import { deriveLanguageVariant, deriveDocumentTitle } from '@/lib/utils/location'

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

  const { resume_id, jd_id } = parsed.data

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('persona_type, location')
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

  if (!resume.parsed_json) {
    return NextResponse.json({ error: 'Resume has not been parsed yet.' }, { status: 400 })
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

  const validatedAdditions = Array.isArray(resume.validated_additions) ? resume.validated_additions : []
  const languageVariant = deriveLanguageVariant(profile.location)

  let finalResume: object
  try {
    const aiResponse = await getCompletion({
      systemPrompt: RESUME_GENERATE_SYSTEM_PROMPT,
      userPrompt: buildResumeGenerateUserPrompt(resume.parsed_json, validatedAdditions, jd.raw_text, profile.persona_type, languageVariant),
      temperature: 0.2,
      maxTokens: 3072,
    })

    finalResume = parseJsonResponse<object>(aiResponse)
  } catch (err) {
    console.error('Resume generation AI error:', err)
    return NextResponse.json({ error: 'Failed to generate final resume. Please try again.' }, { status: 502 })
  }

  const { error: insertError } = await supabase
    .from('generated_documents')
    .insert({
      user_id: user.id,
      doc_type: 'resume',
      content_json: { ...finalResume, document_title: deriveDocumentTitle(languageVariant), language_variant: languageVariant },
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('Failed to save generated resume:', insertError)
    return NextResponse.json({ error: 'Failed to save generated resume.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, resume: finalResume })
}

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCompletion, parseJsonResponse } from '@/lib/ai/client'
import { RESUME_PARSE_SYSTEM_PROMPT, buildResumeParseUserPrompt } from '@/lib/ai/prompts/resume-parse'
import { parseResumeSchema } from '@/lib/validation/schemas'
import { countUserUploadsThisHour } from '@/lib/utils/quota'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse')

const MIN_EXTRACTED_TEXT_LENGTH = 50 // heuristic: below this, likely a scanned/image PDF
const UPLOAD_LIMIT_FREE = 10 // free tier: 10 uploads/hour, paid tiers unlimited

/**
 * POST /api/resume/parse
 *
 * Extracts structured resume data (contact, work_experience, skills, etc.)
 * from an uploaded PDF or manually-entered text, and saves it to the
 * `resumes` row.
 *
 * @body { resume_id: string }
 * @returns 200 { success: true, parsed_json: object }
 * @error 400 INVALID_INPUT — bad body, no file/text on the resume record
 * @error 401 UNAUTHORIZED
 * @error 404 NOT_FOUND — resume doesn't exist or isn't owned by the caller
 * @error 422 INVALID_INPUT — PDF unreadable/scanned/unsupported format
 * @error 429 RATE_LIMITED — free tier exceeded 10 uploads/hour
 * @error 500 INTERNAL_ERROR — storage or database failure
 * @error 502 AI_ERROR — NVIDIA NIM parsing call failed or returned bad shape
 */
export async function POST(request: NextRequest) {
  // Auth check
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  // Validate input
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body', code: 'INVALID_INPUT' }, { status: 400 })
  }

  const parsed = parseResumeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 })
  }

  const { resume_id } = parsed.data

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', user.id)
    .single()

  if ((profile?.subscription_tier ?? 'free') === 'free') {
    const uploadCountThisHour = await countUserUploadsThisHour(supabase, user.id)
    if (uploadCountThisHour >= UPLOAD_LIMIT_FREE) {
      console.log(`[RATE_LIMIT] User ${user.id} exceeded upload limit (${uploadCountThisHour}/${UPLOAD_LIMIT_FREE})`)
      return NextResponse.json(
        {
          error: `Upload limit reached. Free tier: ${UPLOAD_LIMIT_FREE} uploads/hour. Upgrade for unlimited uploads.`,
          code: 'RATE_LIMITED',
        },
        { status: 429 }
      )
    }
  }

  // Fetch resume record — RLS ensures user can only access their own. A
  // mismatched user_id is folded into the same 404 as "doesn't exist" so
  // an unauthorized caller can't distinguish "not yours" from "not real".
  const { data: resume, error: fetchError } = await supabase
    .from('resumes')
    .select('id, user_id, source_type, raw_text, parsed_json')
    .eq('id', resume_id)
    .single()

  if (fetchError || !resume || resume.user_id !== user.id) {
    return NextResponse.json({ error: 'Resume not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  let rawText: string

  if (resume.source_type === 'manual') {
    if (!resume.raw_text) {
      return NextResponse.json({ error: 'No resume text found', code: 'INVALID_INPUT' }, { status: 400 })
    }
    rawText = resume.raw_text
  } else {
    // Uploaded file — download from storage and extract text
    const storagePath = (resume.parsed_json as { storage_path?: string } | null)?.storage_path
    const filename = (resume.parsed_json as { original_filename?: string } | null)?.original_filename

    if (!storagePath) {
      return NextResponse.json({ error: 'No file found for this resume', code: 'INVALID_INPUT' }, { status: 400 })
    }

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('resumes')
      .download(storagePath)

    if (downloadError || !fileBlob) {
      return NextResponse.json({ error: 'Failed to retrieve uploaded file', code: 'INTERNAL_ERROR' }, { status: 500 })
    }

    const arrayBuffer = await fileBlob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (filename?.toLowerCase().endsWith('.pdf')) {
      try {
        const result = await pdfParse(buffer)
        rawText = result.text
      } catch (err) {
        console.error('PDF parse error:', err)
        return NextResponse.json(
          { error: 'Failed to extract text from PDF. The file may be corrupted or image-based.', code: 'INVALID_INPUT' },
          { status: 422 }
        )
      }
    } else {
      // .docx — not handled yet
      return NextResponse.json(
        { error: 'Word document parsing is not yet supported. Please upload a PDF or use manual entry.', code: 'INVALID_INPUT' },
        { status: 422 }
      )
    }

    if (!rawText || rawText.trim().length < MIN_EXTRACTED_TEXT_LENGTH) {
      return NextResponse.json(
        {
          error: 'Could not extract readable text from this PDF. It may be a scanned image. Please use manual entry instead.',
          code: 'INVALID_INPUT',
        },
        { status: 422 }
      )
    }
  }

  // Call AI to parse
  let parsedResume: unknown
  try {
    const aiResponse = await getCompletion({
      systemPrompt: RESUME_PARSE_SYSTEM_PROMPT,
      userPrompt: buildResumeParseUserPrompt(rawText),
      temperature: 0.1,
      maxTokens: 2048,
    })

    parsedResume = parseJsonResponse(aiResponse)
  } catch (err) {
    console.error('Resume parsing AI error:', err)
    return NextResponse.json(
      { error: 'Failed to parse resume. Please try again.', code: 'AI_ERROR' },
      { status: 502 }
    )
  }

  // Basic shape validation on AI output
  if (
    typeof parsedResume !== 'object' ||
    parsedResume === null ||
    !('contact' in parsedResume) ||
    !('work_experience' in parsedResume) ||
    !('skills' in parsedResume)
  ) {
    console.error('Unexpected AI response shape:', parsedResume)
    return NextResponse.json(
      { error: 'Resume parsing returned an unexpected format. Please try again.', code: 'AI_ERROR' },
      { status: 502 }
    )
  }

  // Save parsed result + raw text back to DB
  const { error: updateError } = await supabase
    .from('resumes')
    .update({
      raw_text: rawText,
      parsed_json: parsedResume,
    })
    .eq('id', resume_id)

  if (updateError) {
    console.error('Failed to save parsed resume:', updateError)
    return NextResponse.json({ error: 'Failed to save parsed resume', code: 'INTERNAL_ERROR' }, { status: 500 })
  }

  return NextResponse.json({ success: true, parsed_json: parsedResume })
}

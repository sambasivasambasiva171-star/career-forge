import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCompletion, parseJsonResponse } from '@/lib/ai/client'
import { RESUME_PARSE_SYSTEM_PROMPT, buildResumeParseUserPrompt } from '@/lib/ai/prompts/resume-parse'
import { parseResumeSchema } from '@/lib/validation/schemas'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require('pdf-parse')

const MIN_EXTRACTED_TEXT_LENGTH = 50 // heuristic: below this, likely a scanned/image PDF

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Validate input
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = parseResumeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { resume_id } = parsed.data

  // Fetch resume record — RLS ensures user can only access their own
  const { data: resume, error: fetchError } = await supabase
    .from('resumes')
    .select('id, user_id, source_type, raw_text, parsed_json')
    .eq('id', resume_id)
    .single()

  if (fetchError || !resume) {
    return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
  }

  if (resume.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let rawText: string

  if (resume.source_type === 'manual') {
    if (!resume.raw_text) {
      return NextResponse.json({ error: 'No resume text found' }, { status: 400 })
    }
    rawText = resume.raw_text
  } else {
    // Uploaded file — download from storage and extract text
    const storagePath = (resume.parsed_json as { storage_path?: string } | null)?.storage_path
    const filename = (resume.parsed_json as { original_filename?: string } | null)?.original_filename

    if (!storagePath) {
      return NextResponse.json({ error: 'No file found for this resume' }, { status: 400 })
    }

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('resumes')
      .download(storagePath)

    if (downloadError || !fileBlob) {
      return NextResponse.json({ error: 'Failed to retrieve uploaded file' }, { status: 500 })
    }

    const arrayBuffer = await fileBlob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (filename?.toLowerCase().endsWith('.pdf')) {
      try {
        const parser = new PDFParse({ data: buffer })
        const pdfData = await parser.getText()
        rawText = pdfData.text
      } catch (err) {
        console.error('PDF parse error:', err)
        return NextResponse.json(
          { error: 'Failed to extract text from PDF. The file may be corrupted or image-based.' },
          { status: 422 }
        )
      }
    } else {
      // .docx — not handled yet
      return NextResponse.json(
        { error: 'Word document parsing is not yet supported. Please upload a PDF or use manual entry.' },
        { status: 422 }
      )
    }

    if (!rawText || rawText.trim().length < MIN_EXTRACTED_TEXT_LENGTH) {
      return NextResponse.json(
        {
          error: 'Could not extract readable text from this PDF. It may be a scanned image. Please use manual entry instead.',
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
      { error: 'Failed to parse resume. Please try again.' },
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
      { error: 'Resume parsing returned an unexpected format. Please try again.' },
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
    return NextResponse.json({ error: 'Failed to save parsed resume' }, { status: 500 })
  }

  return NextResponse.json({ success: true, parsed_json: parsedResume })
}

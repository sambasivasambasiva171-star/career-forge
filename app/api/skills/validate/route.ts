import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { validateSkillsSchema } from '@/lib/validation/schemas'

/**
 * POST /api/skills/validate
 *
 * Merge user-approved skill additions (surfaced by the questionnaire flow)
 * into a resume's `validated_additions`, so future generations may draw on
 * them without the AI fabricating them.
 *
 * @body { resume_id: string, approved: object[] }
 * @returns 200 { success: true, validated_additions: object[] }
 * @error 400 INVALID_INPUT
 * @error 401 UNAUTHORIZED
 * @error 404 NOT_FOUND — resume doesn't exist or isn't owned by the caller
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

  const parsed = validateSkillsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 })
  }

  const { resume_id, approved } = parsed.data

  const { data: resume, error: resumeError } = await supabase
    .from('resumes')
    .select('id, user_id, validated_additions')
    .eq('id', resume_id)
    .single()

  if (resumeError || !resume || resume.user_id !== user.id) {
    return NextResponse.json({ error: 'Resume not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const existing = Array.isArray(resume.validated_additions) ? resume.validated_additions : []
  const merged = [...existing, ...approved]

  const { error: updateError } = await supabase
    .from('resumes')
    .update({ validated_additions: merged })
    .eq('id', resume_id)

  if (updateError) {
    console.error('Failed to save validated additions:', updateError)
    return NextResponse.json({ error: 'Failed to save your selections.', code: 'INTERNAL_ERROR' }, { status: 500 })
  }

  return NextResponse.json({ success: true, validated_additions: merged })
}

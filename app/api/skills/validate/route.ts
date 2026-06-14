import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { validateSkillsSchema } from '@/lib/validation/schemas'

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

  const parsed = validateSkillsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { resume_id, approved } = parsed.data

  const { data: resume, error: resumeError } = await supabase
    .from('resumes')
    .select('id, user_id, validated_additions')
    .eq('id', resume_id)
    .single()

  if (resumeError || !resume) {
    return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
  }

  if (resume.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const existing = Array.isArray(resume.validated_additions) ? resume.validated_additions : []
  const merged = [...existing, ...approved]

  const { error: updateError } = await supabase
    .from('resumes')
    .update({ validated_additions: merged })
    .eq('id', resume_id)

  if (updateError) {
    console.error('Failed to save validated additions:', updateError)
    return NextResponse.json({ error: 'Failed to save your selections.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, validated_additions: merged })
}

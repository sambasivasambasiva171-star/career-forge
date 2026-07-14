import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { updateProfileSchema, updateProfileStep1Schema } from '@/lib/validation/schemas'

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

  const parsed = updateProfileSchema.safeParse(body)
  const parsedStep1 = updateProfileStep1Schema.safeParse(body)

  if (!parsed.success && !parsedStep1.success) {
    return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 })
  }

  const updateData = parsedStep1.success ? parsedStep1.data : parsed.data!

  const { error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', user.id)

  if (error) {
    console.error('Failed to update profile:', error)
    return NextResponse.json({ error: 'Failed to update profile.', code: 'INTERNAL_ERROR' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

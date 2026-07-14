import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function POST() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase service role configuration')
    return NextResponse.json({ error: 'Account deletion is not configured.', code: 'INTERNAL_ERROR' }, { status: 500 })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await adminClient.auth.admin.deleteUser(user.id)

  if (error) {
    console.error('Failed to delete user:', error)
    return NextResponse.json({ error: 'Failed to delete account.', code: 'INTERNAL_ERROR' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

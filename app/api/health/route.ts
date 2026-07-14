import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * GET /api/health
 *
 * Uptime/monitoring endpoint. Checks that Supabase is reachable and that
 * the NVIDIA NIM API key is configured. Does not make a billed AI call —
 * there is no documented lightweight health endpoint on the NIM API, and
 * spending money just to check liveness would defeat the point.
 *
 * @returns 200 { status: 'ok', services: { supabase: 'up', nvidia_nim: 'up' } }
 * @returns 503 { status: 'degraded', services, errors: string[] }
 */
export async function GET() {
  const services: Record<string, 'up' | 'down'> = { supabase: 'down', nvidia_nim: 'down' }
  const errors: string[] = []

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase environment variables are not configured')
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).limit(1)

    // RLS denies anonymous reads on `profiles` (no rows, no thrown error) —
    // that's expected and means the project IS reachable. An actual thrown
    // error here means the request never reached Postgres (paused project,
    // network failure, wrong URL).
    if (error) throw error
    services.supabase = 'up'
  } catch (err) {
    errors.push(`supabase: ${err instanceof Error ? err.message : 'unreachable'}`)
  }

  if (process.env.NVIDIA_NIM_API_KEY) {
    services.nvidia_nim = 'up'
  } else {
    errors.push('nvidia_nim: NVIDIA_NIM_API_KEY is not set')
  }

  const allUp = Object.values(services).every((status) => status === 'up')

  return NextResponse.json(
    {
      status: allUp ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services,
      ...(errors.length > 0 ? { errors } : {}),
    },
    { status: allUp ? 200 : 503 }
  )
}

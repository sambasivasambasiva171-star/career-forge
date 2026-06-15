import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { aiLimiter, apiLimiter, authLimiter, getClientIp } from '@/lib/rate-limit'

const AI_ROUTES = [
  '/api/resume/parse',
  '/api/resume/generate',
  '/api/jd/analyze',
  '/api/questionnaire/generate',
  '/api/questionnaire/extract-skill',
  '/api/cover-letter/generate',
  '/api/networking/suggest',
]

const AUTH_ROUTES = ['/login', '/signup', '/forgot-password']

const PUBLIC_ROUTES = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/privacy',
  '/terms',
  '/cookies',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rate limiting (before auth check, so it applies even to unauthenticated requests)
  if (pathname.startsWith('/api/')) {
    const ip = getClientIp(request)
    const isAiRoute = AI_ROUTES.some((route) => pathname.startsWith(route))
    const limiter = isAiRoute ? aiLimiter : apiLimiter
    const limitKey = `${isAiRoute ? 'ai' : 'api'}:${ip}`

    try {
      const { success, limit, remaining, reset } = await limiter.limit(limitKey)
      if (!success) {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.' },
          {
            status: 429,
            headers: {
              'X-RateLimit-Limit': limit.toString(),
              'X-RateLimit-Remaining': remaining.toString(),
              'X-RateLimit-Reset': reset.toString(),
            },
          }
        )
      }
    } catch (err) {
      // If rate limiting itself fails (e.g. Redis unreachable), fail open
      console.error('Rate limit check failed:', err)
    }
  } else if (AUTH_ROUTES.some((route) => pathname.startsWith(route)) && request.method === 'POST') {
    const ip = getClientIp(request)
    try {
      const { success } = await authLimiter.limit(`auth:${ip}`)
      if (!success) {
        return NextResponse.json(
          { error: 'Too many attempts. Please try again later.' },
          { status: 429 }
        )
      }
    } catch (err) {
      console.error('Auth rate limit check failed:', err)
    }
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (
    !user &&
    !pathname.startsWith('/api/') &&
    !PUBLIC_ROUTES.some((route) => pathname.startsWith(route))
  ) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

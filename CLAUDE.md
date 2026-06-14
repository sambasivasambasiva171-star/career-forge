# Career Forge — Claude Context

## Project Purpose
ATS (Applicant Tracking System) resume builder with AI-driven skill discovery.
Users import job descriptions, the AI identifies required skills, and the builder
formats a compliant resume.

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS 3 |
| Auth & Database | Supabase (`@supabase/ssr` + `@supabase/supabase-js`) |
| Validation | Zod |
| AI / LLM | NVIDIA NIM via OpenAI SDK |

## Environment Variables
Required in `.env.local` (never commit this file):
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL (public, used client-side)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (public, used client-side)
- `NVIDIA_NIM_API_KEY` — NVIDIA NIM API key (server-side only, never expose to browser)
- `NVIDIA_NIM_BASE_URL` — NIM base URL (default: `https://integrate.api.nvidia.com/v1`)

## Project Structure
```
career-forge/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx       # Login form — client component
│   │   └── signup/page.tsx      # Signup form — client component
│   ├── globals.css              # Tailwind directives + CSS variables
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Landing — redirects based on auth state
├── lib/
│   ├── ai/
│   │   └── client.ts            # NVIDIA NIM OpenAI-compatible client
│   └── supabase/
│       ├── client.ts            # Browser Supabase client (createBrowserClient)
│       └── server.ts            # Server Supabase client (createServerClient, async)
├── middleware.ts                 # Supabase session refresh on every request
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── postcss.config.mjs
```

## Supabase SSR Patterns

### Browser client (`lib/supabase/client.ts`)
Call `createClient()` inside Client Components (`'use client'`).
`@supabase/ssr` uses `document.cookie` automatically in the browser.

### Server client (`lib/supabase/server.ts`)
`createServerClient()` is **async** because `cookies()` from `next/headers` is
async in Next.js 14. Always `await` it:
```ts
const supabase = await createServerClient()
const { data: { user } } = await supabase.auth.getUser()
```
Always use `getUser()` — never `getSession()` in server code (getSession reads
from the cookie without re-validating with the Supabase server).

### Middleware (`middleware.ts`)
Imports `createServerClient` directly from `@supabase/ssr` (not from `lib/supabase/server.ts`).
Uses `request.cookies` synchronously — `cookies()` from `next/headers` is not
available in the Edge Runtime and will throw.

## AI Integration
`lib/ai/client.ts` exports `nimClient` — an OpenAI SDK instance pointed at NIM.
All AI calls must happen server-side (Route Handlers or Server Actions).

Example usage in a Route Handler:
```ts
import { nimClient } from '@/lib/ai/client'

const completion = await nimClient.chat.completions.create({
  model: 'meta/llama-3.1-70b-instruct',
  messages: [{ role: 'user', content: prompt }],
})
```

## Key Conventions
- Path alias `@/` maps to the project root (configured in `tsconfig.json`)
- `zod` schemas live in `lib/validators/` (to be created)
- Database types will be generated into `lib/types/supabase.ts` via Supabase CLI
- Route protection is enforced in `middleware.ts`; `/login` and `/signup` are public

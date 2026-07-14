# Career Forge — Claude Context

Last verified against the actual codebase: 2026-07-14. If anything below
conflicts with what you read in the code, trust the code and fix this file
— this is a living map for AI sessions with no memory of past ones, and a
stale doc is worse than no doc.

## Project Purpose
ATS (Applicant Tracking System) resume builder with AI-driven skill discovery
and freemium quota enforcement. Users upload a resume, add a job description,
and the AI generates a tailored, ATS-optimized CV variant — deterministically
(same resume+JD always produces the same output) and without fabricating
experience (a post-processing fact gate strips ungrounded content). See
`docs/roadmap.md` for the full locked-scope feature list and
`docs/api.md` for the endpoint reference.

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) — see `package.json` for the exact pinned version |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS 3 |
| Auth & Database | Supabase (`@supabase/ssr` + `@supabase/supabase-js`) |
| Validation | Zod (`lib/validation/schemas.ts`) |
| AI / LLM | NVIDIA NIM via OpenAI SDK (`lib/ai/client.ts`) |
| Rate limiting | Upstash Redis (`@upstash/ratelimit`, `lib/rate-limit.ts`) |
| PDF export | `@react-pdf/renderer`, rendered server-side in API routes |
| Tests | Jest (`npm test`) — see `docs/qa-process.md` |

## Environment Variables
Required in `.env.local` (never commit this file — see `.env.local.example`
for the template):
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL (public, used client-side)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key (public, used client-side)
- `NVIDIA_NIM_API_KEY` — NVIDIA NIM API key (server-side only, never expose to browser)
- `NVIDIA_NIM_BASE_URL` — NIM base URL (default: `https://integrate.api.nvidia.com/v1`)
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` — Upstash Redis, required by
  `lib/rate-limit.ts` for the per-IP rate limiter in `middleware.ts`

Optional:
- `NVIDIA_NIM_MODEL` — override the default model (`meta/llama-3.1-70b-instruct`)
- `RESUME_GENERATION_SEED` — fixed seed for deterministic generation (default: `42`)
- `SUPABASE_SERVICE_ROLE_KEY` — server-side only, used by `/api/account/delete`
  for the admin `auth.admin.deleteUser` call. Never expose to the browser.

## Project Structure
```
career-forge/
├── app/
│   ├── (auth)/            # login, signup, forgot/reset-password — public routes
│   ├── (dashboard)/       # onboarding, upload, job-description, review, account — auth required
│   ├── api/
│   │   ├── resume/        # parse, generate, pdf, pdf-from-data (DEPRECATED)
│   │   ├── jd/            # analyze (gap analysis), preflight (screening check)
│   │   ├── questionnaire/ # generate, extract-skill
│   │   ├── cover-letter/  # generate, pdf
│   │   ├── networking/    # suggest
│   │   ├── skills/        # validate
│   │   ├── account/       # update, delete
│   │   └── health/        # GET — uptime/monitoring check, no auth required
│   ├── privacy/, terms/, cookies/   # public legal pages
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx            # Landing — redirects based on auth state
├── components/              # shared client components (PDF download button, scan preview, etc.)
├── lib/
│   ├── ai/
│   │   ├── client.ts        # exports getCompletion() + parseJsonResponse() — NOT a raw client export
│   │   └── prompts/         # one file per AI feature's system/user prompt builders
│   ├── supabase/
│   │   ├── client.ts        # Browser Supabase client (createBrowserClient)
│   │   └── server.ts        # Server Supabase client (createServerClient, async)
│   ├── utils/
│   │   ├── quota.ts          # freemium quota + per-user upload rate limit
│   │   ├── fact-check.ts     # anti-hallucination fact gate
│   │   ├── keyword-score.ts  # ATS match scoring
│   │   └── cv-postprocess.ts # 6-second-scan enforcement (bullet/summary caps)
│   ├── rate-limit.ts         # Upstash Redis limiters, used by middleware.ts
│   └── validation/schemas.ts # all Zod schemas in one file
├── supabase/migrations/       # SQL migrations, applied via `supabase db push` (see docs/deployment-runbook.md)
├── tests/                     # Jest tests — see docs/qa-process.md
├── docs/                       # architecture, API reference, runbooks — see docs/README.md
├── middleware.ts               # rate limiting (Upstash) + Supabase session refresh + auth redirect
├── next.config.mjs             # NOTE: .mjs, not .ts — Next.js 14/15 don't support next.config.ts
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
Does three things, in this order, on every request:
1. **Rate limiting** (Upstash Redis via `lib/rate-limit.ts`) — per-IP, before
   any auth check, so it applies even to unauthenticated requests. AI routes
   get a stricter limiter than general API routes; auth POSTs get their own.
2. **Session refresh** — imports `createServerClient` directly from
   `@supabase/ssr` (not from `lib/supabase/server.ts`). Uses `request.cookies`
   synchronously — `cookies()` from `next/headers` is not available in the
   Edge Runtime and will throw.
3. **Auth redirect** — unauthenticated users hitting a non-public,
   non-`/api/` route get redirected to `/login`. API routes handle their own
   401s instead of being redirected.

If you add a new AI-calling route, add it to the `AI_ROUTES` array at the top
of `middleware.ts` or it'll get the looser general-API rate limit instead.

## AI Integration
`lib/ai/client.ts` exports `getCompletion()` and `parseJsonResponse()` — there
is no raw client export; the OpenAI SDK instance is created lazily inside
`getCompletion()` and never exposed directly. All AI calls must happen
server-side (Route Handlers only — no Server Actions are used in this app).

Example usage in a Route Handler:
```ts
import { getCompletion, parseJsonResponse } from '@/lib/ai/client'

const aiResponse = await getCompletion({
  systemPrompt: SOME_SYSTEM_PROMPT,
  userPrompt: buildSomeUserPrompt(input),
  temperature: 0.2,
  maxTokens: 2048,
  // pass a `seed` for deterministic output (resume/cover-letter generation does this)
})
const result = parseJsonResponse<SomeResultType>(aiResponse)
```
Every call logs an `[AI_USAGE]` line with duration, token counts (preferring
the API's real `usage` field over estimation), and an UNVERIFIED cost
estimate — see the comment above `ESTIMATED_INPUT_COST_PER_1M_TOKENS` in
`lib/ai/client.ts` before trusting those numbers for budgeting.

## Error Response Convention
Every API error response has the shape `{ error: string, code: string }`.
See `docs/api.md` for the full code list. The one rule to preserve when
adding a new route: **ownership checks fold into the same 404 as
"doesn't exist"** — never return a distinct 403 for "this record belongs to
someone else." Returning a different status code for "not yours" vs. "not
real" lets an attacker enumerate other users' record IDs by status code
alone. Pattern:
```ts
if (error || !record || record.user_id !== user.id) {
  return NextResponse.json({ error: 'X not found', code: 'NOT_FOUND' }, { status: 404 })
}
```

## Freemium Quota
`lib/utils/quota.ts` enforces 3 free CV generations/calendar month
(`profiles.subscription_tier === 'free'`); paid tiers are unlimited. Quota
resets automatically on the UTC month boundary — no cron job, since
`countUsageThisMonth` filters `created_at` against the current month's
start/end on every check. The same file also rate-limits free-tier resume
*uploads* (10/hour, independent of the IP-based Redis limiter in
`middleware.ts`). See `docs/business-metrics.md` before changing quota
numbers — no pricing/limit decision has been validated against real usage.

## Key Conventions
- Path alias `@/` maps to the project root (configured in `tsconfig.json`
  **and** `jest.config.js`'s `moduleNameMapper` — the latter is required
  separately because `jest.mock('@/...')` calls aren't rewritten by SWC)
- `zod` schemas all live in `lib/validation/schemas.ts` (one file, not a
  directory — despite what earlier versions of this doc said)
- Database types are not currently generated into a `lib/types/supabase.ts`
  file — queries use inferred/manual types. Generate types with the
  Supabase CLI before relying on this being auto-checked.
- Route protection is enforced in `middleware.ts`; `/login`, `/signup`,
  `/forgot-password`, `/reset-password`, `/privacy`, `/terms`, `/cookies`
  are the public routes (see `PUBLIC_ROUTES` in `middleware.ts`)
- Further docs: `docs/README.md` is the index for API reference, deployment,
  troubleshooting, roadmap, and business/growth planning docs

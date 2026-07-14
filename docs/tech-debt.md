# Technical Debt Log

Last updated: 2026-07-14

## Addressed this session (2026-07-14)

- **Error-response standardization (Security)** — every route that checked
  `if (!X) return 404` then `if (X.user_id !== user.id) return 403` now
  folds both into a single 404. An unauthorized caller probing another
  user's resume/JD ID gets the same response as a nonexistent ID, closing
  a user-ID enumeration side-channel. Applied across 9 route files
  (`resume/generate`, `resume/parse`, `cover-letter/generate`, `jd/analyze`,
  `jd/preflight`, `networking/suggest`, `questionnaire/generate`,
  `questionnaire/extract-skill`, `skills/validate`).
- **Per-user upload rate limit (Security)** — `/api/resume/parse` now caps
  free-tier users at 10 uploads/hour (`countUserUploadsThisHour` in
  `lib/utils/quota.ts`), independent of the existing IP-based Redis limiter
  in `middleware.ts` (which caps by IP, not by account — a free-tier user
  behind a shared/rotating IP wasn't meaningfully capped before this).
- **Structured error codes (Fullstack)** — every error response across the
  API now includes a stable `code` field (`UNAUTHORIZED`, `INVALID_INPUT`,
  `NOT_FOUND`, `QUOTA_EXHAUSTED`, `RATE_LIMITED`, `AI_ERROR`,
  `INTERNAL_ERROR`) so clients can branch on `code` instead of parsing
  `error` strings. See `docs/api.md`.
- **JSDoc on route handlers (Fullstack)** — every `POST`/`GET` handler now
  documents its body shape, success response, and possible error codes
  directly above the function.
- **Quota query index (Database)** — added
  `supabase/migrations/20260714150000_add_quota_index.sql`, a partial index
  on `generated_documents(user_id, created_at, doc_type) WHERE doc_type =
  'resume'` matching the exact filter `countUsageThisMonth` runs on every
  generation request. **Not yet applied to the live database** — no
  Supabase CLI/project link exists in this environment (see "Blocked" below).
- **Health check endpoint (DevOps)** — `GET /api/health` checks Supabase
  reachability and that `NVIDIA_NIM_API_KEY` is configured. Deliberately
  does NOT make a real NIM completion call (costs money, and there is no
  documented lightweight health endpoint on the NIM API to probe instead).
- **AI token/cost logging (AI Integration)** — `getCompletion()` in
  `lib/ai/client.ts` now logs token counts (preferring the API's real
  `usage` field over estimation) and a rough cost estimate per call,
  replacing the old timing-only `[AI TIMING]` log with `[AI_USAGE]`. The
  per-token cost constants are marked UNVERIFIED — NVIDIA NIM doesn't
  publish a stable price sheet; verify before using these numbers for
  budgeting.
- **Error-path test coverage (QA)** — `lib/utils/quota.test.ts` gained real
  (non-placeholder) unit tests for `checkQuota`, `countUsageThisMonth`, and
  `countUserUploadsThisHour`, including the calendar-month reset boundary.
  `tests/api/resume-generate-errors.test.ts` is new: it exercises
  `/api/resume/generate` end-to-end at the handler level (Supabase and the
  AI client mocked) for 401, 404-not-403, 402, 502, and the cache-hit path.
  All 18 tests in the suite are green as of this session — run `npm test`.
- **Jest module resolution fix** — `jest.config.js` was missing a
  `moduleNameMapper` for the `@/*` path alias. Plain `import` statements
  worked anyway (SWC rewrites those at compile time), but `jest.mock('@/...')`
  could not resolve at all. Fixed; this was blocking any future test that
  needs to mock a `@/`-aliased module.

## Deferred (post-payment / post-PMF)

- **Service layer abstraction (Architecture)** — business logic lives
  directly in route handlers. Fine at this scope (one deployable, ~20
  routes); revisit if/when routes start duplicating non-trivial logic.
- **Full integration test suite against a real test database (QA)** — the
  new tests mock Supabase at the handler level, which verifies branching
  logic but not RLS policies or actual query correctness. Stand up a
  Supabase test project (or local `supabase start`) before this gets risky
  to skip — likely warranted once Stripe webhooks add another untested
  integration surface.
- **Analytics instrumentation (Growth)** — zero event tracking exists
  today. See `docs/analytics-plan.md` for the planned event schema; not
  implemented, since there's no PostHog/Plausible project configured yet.
- **Error-code coverage on `resume/pdf-from-data`** — this route is marked
  `DEPRECATED` in its own file header (superseded by client-side PDF
  generation). Left untouched rather than polishing dead code; delete it
  once the dashboard's old PDF links are confirmed migrated.

## Blocked on external access (cannot do from this environment)

- **`supabase db push` / `supabase db pull`** — no Supabase CLI is
  installed and no project is linked in this Codespace. The quota-index
  migration file exists in the repo but has NOT been applied to the live
  database, and there is no schema baseline pulled. Someone with Supabase
  project credentials needs to run:
  ```bash
  supabase link --project-ref <ref>
  supabase db push   # applies the new migration
  supabase db pull   # captures a schema.sql baseline for version control
  ```
- **Vercel deploy verification** — `docs/deployment-runbook.md` describes
  the process, but nobody has run a deploy in this session to confirm the
  health check behaves as expected in production (Vercel serverless
  environment differs from local `node`).

## Accepted risks (not fixed this session, no action planned yet)

- **Free-tier Supabase auto-pause after 7 days idle** — see
  `docs/troubleshooting.md` and `docs/deployment-runbook.md`. No keep-alive
  cron or Pro upgrade has been set up.
- **No staging environment** — all testing happens locally or directly
  against whatever Supabase project `.env.local` points at. Acceptable at
  current scale; revisit before the first paid-tier launch.

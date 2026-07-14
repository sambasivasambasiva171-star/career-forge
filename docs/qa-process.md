# QA & Testing Process

## Automated tests (Fact — exists today, run `npm test`)

As of 2026-07-14: 3 suites, 18 tests, all passing.

- `lib/utils/quota.test.ts` — unit tests for `checkQuota`,
  `countUsageThisMonth`, `countUserUploadsThisHour`, including the
  calendar-month reset boundary. Uses a lightweight thenable mock of the
  Supabase query builder — no real database involved.
- `tests/api/resume-generate-errors.test.ts` — handler-level tests for
  `/api/resume/generate` covering 401, 404 (not-found and
  wrong-owner cases both return 404, per the security fix), 402, 502, and
  the cache-hit path. Supabase and the AI client are mocked.
- `tests/acceptance/cv-generation-determinism.test.ts` — currently a
  documentation placeholder (`expect(true).toBe(true)`) describing manual
  test steps for determinism and match-score visibility. **This is not a
  real test** — it always passes regardless of app behavior. Replace with
  a real integration test once a test Supabase project exists (see
  `docs/tech-debt.md`, "Blocked on external access").

**What automated tests do NOT cover:** RLS policy correctness, real
Supabase query behavior, real NVIDIA NIM responses, or anything requiring
a live database/API. These are unit/handler tests with mocked
dependencies — they verify branching logic, not integration correctness.

## Manual pre-launch checklist

### Happy path
- [ ] Upload resume → parses successfully within a few seconds
- [ ] Add job description → ready for generation
- [ ] Generate CV → shows a loading state, completes in the 2–5s range
- [ ] Match score banner displays with correct color coding
- [ ] 6-second scan preview toggle works
- [ ] Download PDF succeeds and opens correctly
- [ ] Regenerate same resume+JD (no `regenerate` flag) → instant cache hit

### Quota enforcement
- [ ] Free-tier user generates 3 CVs → 4th attempt returns 402 with an
      "upgrade" message, not a generic error
- [ ] Quota display ("2 of 3 remaining") updates correctly after each
      generation

### Error paths (now covered by the automated suite above, but worth a
manual click-through before a first production deploy since the
automated tests mock the database)
- [ ] Accessing another user's resume/JD by guessing an ID → 404, not a
      403 or a stack trace
- [ ] 11th upload within an hour (free tier) → 429 with a clear message
- [ ] Disconnect network mid-generation → times out gracefully, no white
      screen

### Responsive design
See `docs/ui-ux-checklist.md` — not yet verified against a real browser
this session.

## Bug severity triage (for anything found above)

- **Critical** (data loss, wrong charges, can't use the app, security) →
  fix before anything else ships
- **Major** (a feature is broken, no workaround) → fix before release
- **Minor / Cosmetic** → log in `docs/tech-debt.md` and schedule

## Post-launch: moving toward automation

Manual clicking doesn't scale past a handful of releases. Next
investment, in order:
1. A real Supabase test project (local `supabase start` or a dedicated
   cloud project) so `tests/acceptance/*` can become real integration
   tests instead of documentation placeholders.
2. Playwright for the happy-path browser flow (upload → generate →
   download), run in CI before each deploy.
3. Only after 1 and 2 are stable: expand Playwright to responsive-design
   checks, replacing the manual checklist above.

## Monitoring (production correctness, not pre-release QA)

- `GET /api/health` — see `docs/deployment-runbook.md` for expected
  polling cadence and alerting setup.
- Watch for a spike in `AI_ERROR`/`INTERNAL_ERROR` codes in logs — that's
  the fastest signal something is broken in production that the manual
  checklist won't catch until the next release cycle.

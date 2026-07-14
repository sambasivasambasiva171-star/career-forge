# Product Roadmap

Last updated: 2026-07-14. Status reflects what's actually in the codebase,
not aspiration — see `docs/tech-debt.md` for the session-by-session diff.

## Phase 1: Locked scope (Fact — shipped)

Verified present in the codebase as of this doc's date:
- ATS parse-check on resume upload (`/api/resume/parse`)
- Keyword match scoring vs. job descriptions (`lib/utils/keyword-score.ts`,
  surfaced as `match_score` on generated documents)
- Pre-screening question coach (`/api/jd/preflight`, `/api/questionnaire/*`)
- 6-second hiring manager scan simulation (documented in `README.md`,
  enforced via summary/bullet caps in `lib/utils/cv-postprocess.ts`)
- X-Y-Z bullet rewriting with an anti-hallucination fact gate
  (`lib/utils/fact-check.ts`)
- Saved CV variants per job application, cached by resume+JD pair
  (`generated_documents` table)
- Freemium quota (3 free CV generations/month — `lib/utils/quota.ts`)
- Networking outreach suggestions (`/api/networking/suggest`)
- Cover letter generation (`/api/cover-letter/generate`)

## Phase 1.5: Hardening (this session, 2026-07-14)

Security, error-handling, docs, and test-coverage fixes from the
multi-disciplinary review — see `docs/tech-debt.md` for the full list.
Notably **not** included: applying the new DB migration to the live
database (no Supabase CLI access in this environment — see
`docs/tech-debt.md` "Blocked on external access").

## Phase 2: Payment + Analytics (Recommendation — not started)

**Fact:** no payment processor is integrated anywhere in this codebase
(`grep -r stripe` returns nothing). `subscription_tier` can only be set
directly in the database today.

Scope:
- Payment provider integration (Stripe is the conventional default for a
  Next.js + Supabase stack, but this hasn't been evaluated against
  alternatives in this session — confirm before committing)
- Webhook handling for tier upgrades/downgrades/cancellations
- Event tracking per `docs/analytics-plan.md` (currently zero
  instrumentation exists)
- A real analytics dashboard once events are flowing

**Gate before starting:** apply the pending quota-index migration and
confirm the freemium quota mechanism is stable under real usage first —
adding a second untested integration surface (billing webhooks) on top of
an unverified quota system compounds risk.

## Phase 3: Retention features (Recommendation — see docs/retention-roadmap.md)

Ordered by build cost, not by assumed impact (impact is unvalidated — no
usage data exists yet):
1. Surface/promote the already-built networking suggestions feature
2. Give cover letters their own quota and surface them in the main flow
3. Job alerts (new infrastructure: scheduled job + email delivery)
4. Interview-outcome feedback loop (research-grade, don't scope a sprint
   for this without a spike first)

## Phase 4: Scale / enterprise (Recommendation — speculative, not scoped)

Bulk generation, team accounts, API access. Do not start any of this
before Phase 2/3 gates are met — building for scale before PMF is
validated is the most common way small products die (per the
software-architect skill's mindset: "design for the first hundred, not a
million").

## Principles carried over from the specialist team standard

- No building before verification (**G2**): a phase-3 feature doesn't
  count as done until it has a passing test or a documented manual test
  script — see `docs/qa-process.md`.
- No deploy without a rollback plan (**G3**): see
  `docs/deployment-runbook.md`.
- No destructive DB operation without explicit approval (**G4**) — this
  applies directly to the pending migration; someone with Supabase access
  must review it before running `supabase db push`.

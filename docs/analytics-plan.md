# Analytics & Growth Instrumentation Plan

## Current state (Fact)

Zero event instrumentation exists in the codebase today. The only signals
currently available are server logs (`console.log`/`console.error`),
which are not queryable analytics — they answer "did this one request
work" (useful for on-call debugging), not "what fraction of users reach
the success moment" (what this doc is about). This plan is **not yet
implemented** — no PostHog/Plausible package is installed
(`grep -r posthog package.json` returns nothing).

## Success moment (Recommendation)

Propose: **a user generates their first tailored CV** (`cv_generated`
event with `is_cached: false`) is the activation moment — it's the first
point the AI actually delivers the product's core value, as opposed to
signup or resume upload, which are setup steps.

## Funnel (Recommendation, mapped to actual routes)

```
signup → resume uploaded (/api/resume/parse) → JD added (/api/jd/analyze)
  → CV generated (/api/resume/generate) → CV downloaded (/api/resume/pdf)
  → [returns next week] → generates again or hits quota
```

Each arrow is a potential drop-off point. Instrument all of them — a
funnel with gaps is worse than no funnel, because it hides which step is
actually the leak.

## Event schema (Recommendation — none of this is implemented yet)

```json
// cv_generated
{ "event": "cv_generated", "user_id": "uuid", "match_score": 85, "is_cached": false, "quota_remaining": 2 }

// quota_exhausted
{ "event": "quota_exhausted", "user_id": "uuid", "tier": "free", "quota_used": 3, "quota_limit": 3 }

// upgrade_clicked
{ "event": "upgrade_clicked", "user_id": "uuid", "trigger": "quota_exhausted" }
```

Add a server-side timestamp at send time; don't trust client clocks.

## Metrics this would let you compute (Recommendation)

- **Activation rate** = users with ≥1 `cv_generated` (is_cached: false) ÷
  total signups
- **Day-7 retention** = users active day 7 ÷ users active day 1
- **Quota exhaustion rate** = users hitting `quota_exhausted` ÷ active
  free-tier users (a *high* rate here is a good sign — it means people are
  actually using the product enough to hit the wall)
- **Upgrade conversion** = users on `premium`/`enterprise`
  (`profiles.subscription_tier` — **Fact**, this column exists today) ÷
  total users

No targets are stated here as facts — see `docs/business-metrics.md` for
proposed targets, explicitly labeled as unvalidated assumptions.

## Tooling (Recommendation, UNVERIFIED pricing/limits — check current terms
before committing)

- **PostHog** — self-hostable or cloud, has a free tier last the author
  verified in training data; confirm current limits before relying on
  them.
- **Plausible** — privacy-friendly web analytics; doesn't cover custom
  product events on its own, only page views. Wouldn't replace the event
  schema above.
- **Sentry** — separate concern (error tracking, not product analytics);
  see `docs/deployment-runbook.md`.

## Privacy (per the security-privacy-engineer baseline)

- Don't send resume content, job description text, or any personal data
  in event payloads — `user_id` and structural metadata (`match_score`,
  `tier`, counts) only.
- Disclose event tracking in the privacy policy (`app/privacy/page.tsx`
  exists — check it's updated before shipping this).

## Implementation is NOT done this session

This document is the plan. Actually wiring events into the app is
deferred — it requires choosing and provisioning a tool (PostHog account,
API key as an env var) before any code lands, which is an external-service
decision for the founder, not something to guess at from this environment.

# Idea Validation & Stress Testing

## Core thesis (Assumption, not independently verified this session)

"Job seekers don't know whether their resume passes ATS keyword filtering
or holds a hiring manager's attention in the first few seconds of review.
An AI tool that shows keyword match against a specific job description,
visualizes a time-boxed scan, and rewrites bullets for impact — without
fabricating experience — helps candidates pass screening more often."

This framing matches what's actually built (see `docs/roadmap.md` Phase
1). Whether it's *true* that this materially improves interview rates is
unvalidated — no user outcome data exists in this repo or session.

## Stress tests

### "What if ATS systems become semantic instead of keyword-based?"
The product's core mechanism (`lib/utils/keyword-score.ts`) is explicitly
keyword-match based. If ATS vendors shift to semantic/embedding-based
matching, the match-score feature specifically would need rearchitecting
— not a small change, since match scoring is wired into the generation
response and the review-page UI. **Mitigation:** none built yet; this is
a real architectural exposure, not a hypothetical one, and should be
tracked as a dependency risk, not dismissed.

### "What if users just use a general-purpose AI chat tool instead?"
The stated differentiator against this is the anti-hallucination fact
gate (`lib/utils/fact-check.ts` — real, shipped, verifiable in code) plus
deterministic output (`temperature: 0`, fixed seed in
`lib/ai/client.ts` — also real). This is the strongest, most concrete
differentiation claim available. It is *not* verified that end users
actually notice or value this over a general chat tool — that's a
messaging and onboarding problem (does the product explain *why* this
matters, visibly?), not just a technical one.

### "What if nobody converts to paid?"
**Fact:** there is currently no payment integration at all (see
`docs/business-metrics.md`), so this question is currently unanswerable
from usage data — there's no paid tier to convert into yet. The
prerequisite question ("does anyone come back after 3 free CVs?") is
answerable sooner and should be answered first (see
`docs/analytics-plan.md`).

### "What if recruiting teams are the real buyer, not job seekers?"
Plausible pivot (see below) — the same match-scoring engine could serve a
recruiter screening candidates instead of a candidate screening
themselves against a JD. Not scoped or built; flagged as a genuine
alternate market, not dismissed.

## Pivot options, if the core thesis doesn't hold

1. **Recruiting-team screening tool** — same matching engine, B2B pricing
   model instead of freemium-consumer. Requires new auth/roles (multi-seat
   accounts don't exist in the current schema — `profiles` is 1:1 with
   `auth.users`).
2. **LinkedIn/profile optimization** instead of full resume generation —
   smaller surface area, could reuse the keyword-matching and fact-gate
   logic directly.
3. **Interview-prep coaching** — moves further down the funnel from
   "get past the screen" to "do well once you're through it." Would reuse
   the questionnaire/coaching infrastructure (`/api/questionnaire/*`)
   more than the resume-generation core.

## Decision framework (Recommendation)

The single most informative number to watch, once instrumented
(`docs/analytics-plan.md`): **day-7 retention**. It's a better read on
whether the thesis holds than any pricing experiment, because it doesn't
depend on a payment system existing yet.

- Retention holds up reasonably → continue building Phase 2/3 as planned.
- Retention is weak but activation is strong → the loop itself needs
  rework before considering a pivot (see `docs/retention-roadmap.md`).
- Both are weak → treat the pivot options above as live alternatives, not
  a last resort — revisit this document with real data before assuming
  the original thesis is wrong.

No verdict ("Refine & proceed" / "Reshape" / "Rethink") is given here as
a fact — that call belongs to the founder once real usage data exists,
not to a code-reading session.

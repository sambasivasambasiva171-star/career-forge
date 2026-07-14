# Business Model & PMF Validation

Every number below is either **Fact** (verifiable in this repo),
**Assumption** (a starting point to validate, not a target to trust), or
explicitly marked **UNVERIFIED**. Nothing here should be treated as a
business decision — that's the founder's call, not something to assert
from reading code.

## Current state (Fact)

- A freemium quota model is implemented: 3 free CV generations/calendar
  month, unlimited for `premium`/`enterprise` tiers
  (`lib/utils/quota.ts`, `profiles.subscription_tier`).
- **No payment processor is integrated.** There is no Stripe (or any
  billing provider) code in this repo — `subscription_tier` can currently
  only be set by an admin directly in the database. Anyone claiming a
  specific price point ($X/month) is describing a plan, not a shipped
  feature.

## Revenue model (Recommendation, not yet decided)

- **Free tier:** 3 CV generations/month (shipped).
- **Paid tier:** unlimited generations, price TBD — the prompt that
  originally described this task suggested $9.99/month, but that is an
  **UNVERIFIED, undecided** number with no market research behind it in
  this repo. Anchor pricing to a comparable product's actual public price
  before committing (a competitor audit hasn't been done in this session).

## Unit economics — UNVERIFIED, illustrative only

CAC, LTV, and any ratio built from them require real acquisition spend
and real retention data, neither of which exist yet (see
`docs/analytics-plan.md` — zero instrumentation is live). Do not use
placeholder LTV:CAC ratios to make a go/no-go call; that would be
manufacturing false certainty over an unmeasured product.

## PMF validation metrics for a beta cohort (Recommendation)

Propose measuring these once analytics is wired up (they are currently
**not measurable** — no events exist):

| Metric | Why it matters |
|---|---|
| Activation rate (≥1 non-cached CV generated) | Confirms new users reach the core value moment |
| Day-7 retention | Confirms the product is sticky, not a one-time tool |
| Quota exhaustion rate | A *high* rate is a positive signal — real engagement |
| Upgrade conversion | Confirms willingness to pay, whatever price is chosen |
| Average match score (`content_json.match_score`) | Confirms the AI output is actually useful, not just fast |

No numeric targets are stated as facts here — set them after the first
2–4 weeks of real instrumented data, not before.

## Kill / adjust / continue criteria (Recommendation)

Define these explicitly with the founder before beta, not after:
- If activation is low → the problem is onboarding/first-run experience,
  not pricing. Fix the UX before touching monetization.
- If activation is fine but day-7 retention is low → the core loop
  doesn't bring people back; prioritize `docs/retention-roadmap.md` over
  new acquisition spend.
- If both are healthy but upgrade conversion is near zero → re-examine
  price point and what the paid tier actually unlocks, before assuming
  the whole model is broken.

## Verdict

**Adjust, not Go or Stop.** The product has a working core loop and a
technically sound freemium mechanism, but zero real usage data exists to
validate any monetization number. The riskiest unknown is not "will
people pay $X" — it's "does anyone come back after the first 3 CVs,"
which is answerable within weeks once `docs/analytics-plan.md` ships.

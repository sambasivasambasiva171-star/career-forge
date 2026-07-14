# Acquisition Strategy

Labeled per the market-business-analyst grounding rules: **Fact**,
**Assumption**, **Recommendation**. No competitor names, user counts, or
market-size figures are asserted here — none were researched this
session (no web search was performed), and fabricating them would be
worse than leaving the gap visible.

## What the audience does today (Assumption, not researched)

Job seekers currently use: generic resume templates, manual keyword
matching by re-reading the JD themselves, general-purpose tools like
ChatGPT for rewriting bullets, and paid resume-review services. This list
is a reasonable guess based on the product's own positioning (ATS
optimization, keyword matching) — it is **not** backed by a competitor
audit in this session. Recommend running one (search "ATS resume
optimizer" and similar queries) before finalizing messaging.

## Why someone would switch (Recommendation, honesty rating: moderate)

The stated differentiators, as implemented in this codebase:
- **Determinism** (temperature=0, fixed seed — `lib/ai/client.ts`): same
  resume+JD always produces the same CV. Real and verifiable, but a
  differentiator only if users actually notice/value output stability —
  unvalidated.
- **Anti-hallucination fact gate** (`lib/utils/fact-check.ts`): strips
  fabricated companies/credentials. Real, and addresses a genuine known
  failure mode of "just use ChatGPT" — this is the strongest
  differentiation claim available, rated **moderate-to-strong** *if*
  users have been burned by AI-fabricated resumes before (unverified how
  common that is).
- **6-second scan simulation**: a real, shipped feature
  (documented in `README.md`) with no direct equivalent commonly known in
  this space — rated **weak-to-moderate** as a switching reason on its
  own, since it's a nice-to-have visualization rather than a blocking
  problem-solver.

## Path to first 100 users (Recommendation — specific, not "do marketing")

Given zero acquisition spend has happened yet:
1. Content: a small number of specific posts explaining the
   anti-hallucination fact gate as a technical trust signal (developer/
   technical job-seeker audiences tend to respond to "how it works"
   content over generic marketing copy).
2. Direct outreach to communities where job seekers already gather
   (specific subreddit/Discord names deliberately omitted here — verify
   current community rules on self-promotion before posting, don't spam).
3. Product Hunt or similar launch, timed after the Phase 2 payment
   integration ships (launching a freemium tool with no way to ever pay
   wastes the launch's conversion window).

## Kill criteria (Recommendation)

If, after a real launch attempt with actual instrumentation
(`docs/analytics-plan.md`) in place:
- Activation rate stays low despite traffic → the landing/onboarding
  experience is the problem, not the channel. Don't scale spend into a
  leaky funnel.
- Users activate but don't return → this is a retention problem (see
  `docs/retention-roadmap.md`), not an acquisition problem — more traffic
  won't fix it.

## Verdict

**Adjust.** No acquisition channel has been tested. The honest next step
is a small, cheap, measured first attempt (option 1 or 2 above) with
analytics in place to read the result — not a broad paid-channel bet.

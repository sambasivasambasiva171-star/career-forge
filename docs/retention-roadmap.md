# Post-Launch Retention Roadmap

Status labels used throughout: **Fact** (true today, verifiable in code),
**Assumption** (plausible, unvalidated), **Recommendation** (judgment call).

## The problem (Assumption)

The product's locked-scope loop is: upload resume → add JD → generate CV
→ apply. A free-tier user gets 3 CV generations/month (**Fact** —
`lib/utils/quota.ts`). Once those 3 are used and no interview callback
arrives, there's currently no mechanism pulling the user back into the
app before next month's quota resets. This is a plausible churn point,
not a measured one — no usage data exists yet to confirm it's the actual
biggest leak (see `docs/analytics-plan.md`; instrument before assuming).

## Retention hooks, in build-order (Recommendation)

Ranked by (a) how directly they extend the existing job-application loop
and (b) how much new infrastructure they need.

### 1. Cover letter generation
**Fact:** already built — `app/api/cover-letter/generate/route.ts` exists
and works today, grounded in an already-generated resume variant. It is
not currently gated by its own quota or surfaced as a retention hook in
onboarding.
**Recommendation:** give cover letters their own free-tier allowance
(separate from the 3 CV/month limit) so a user who exhausts CV quota
still has a reason to open the app for the same job application.

### 2. Job alerts
**Assumption:** users would opt into saved searches ("Senior Engineer,
NYC") and return weekly for new matches. Not validated — no signal yet
that users want this vs. just re-visiting job boards directly.
**Effort:** needs a new table, a scheduled job (Vercel cron or Supabase
Edge function), and an email delivery path (currently none exists —
Supabase Auth emails are the only email sends today).

### 3. Interview-outcome feedback loop
**Assumption:** users would self-report "got an interview" against a
specific generated CV, and that signal could tune future keyword/bullet
choices. Unvalidated and the hardest to build well — a naive version
(free-text field) is cheap; a version that actually improves generation
quality is a research project, not a sprint.

### 4. Networking suggestions (surface existing feature)
**Fact:** `app/api/networking/suggest/route.ts` already exists and is
built. **Recommendation:** this is the cheapest retention lever available
— it needs promotion/discoverability work, not new engineering. Check
whether it's actually linked from the review page's primary flow before
building anything new.

### 5. Progress/analytics dashboard for the user
**Assumption:** showing a user "your average match score is X%" or "N%
of your CVs pass ATS" drives a habit loop via social-proof/self-tracking.
Depends entirely on `docs/analytics-plan.md` being implemented first —
there's no data to show yet.

## Open question for the founder

Before committing engineering time to any of the above: is the goal
"more monthly active users" or "more paid conversions"? Cover letters and
networking-surface work serve the free loop; a feedback loop and
analytics dashboard are more clearly conversion levers. These aren't the
same roadmap — see `docs/business-metrics.md` for the PMF metrics that
should decide which one comes first.

# Skill Gap Analysis Redesign

## What changed

- Line-by-line matching → strategic categorization (core competency /
  transferable / job-specific / baseline)
- "44% match" → "70% ready immediately + 30% trainable"
- No competitive advantages visible → highlights rare strengths found in
  the resume text
- Literal feedback → confidence-building narrative + a hiring-probability
  estimate with stated reasoning

## Relationship to the existing gap analysis (`/api/jd/analyze`)

**This is a second, parallel skill-gap feature, not a replacement.**
`/api/jd/analyze` already exists, calls the AI to do a real semantic
match/partial-match/missing-skill breakdown, and persists results to
`job_descriptions.parsed_keywords` and the `skill_gaps` table. This new
`/api/skill-gap/strategic` endpoint is entirely rule-based (a 15-keyword
hardcoded list in `extractSkillsFromText`, string `.includes()` matching)
and does not read from or write to either of those — it's a fully
independent code path computing its own answer from scratch.

That's a real duplication worth flagging rather than quietly shipping:
the two endpoints can disagree about the same resume+JD pair (one is
AI-driven and can recognize skills described differently across CV and
JD; the other only matches keyword strings from a fixed, small list), and
nothing here reconciles them. Recommend deciding whether this is
(a) an intentional additive "confidence framing" layer that should
eventually consume `/api/jd/analyze`'s AI-extracted skill list instead of
its own hardcoded keyword list, or (b) a full replacement — right now it
is neither, it's an unconnected parallel system.

## Known limitation: hardcoded skill vocabulary

`extractSkillsFromText`'s 15-keyword list is a small, fixed vocabulary.
It will not detect skills phrased differently than the exact strings in
that list (e.g. a JD asking for "collaborative teamwork" won't match
`extractSkillsFromText`'s `'teamwork'` check unless the substring is
present verbatim). This is a real accuracy ceiling on the feature as
built — the existing AI-based `/api/jd/analyze` doesn't have this
limitation.

## Bugs fixed while implementing this session (vs. the original spec)

1. **Wrong Supabase import.** The route as specified imported `createClient`
   from `@/lib/supabase/server` — that export doesn't exist; the actual
   export is `createServerClient` (see every other route in `app/api/`).
   Fixed to match.
2. **`computeReadinessScore`'s type didn't match its own return value.**
   `ReadinessScore.job_specific` requires a `trainable_count: number`
   field, but the function returned `results.job_specific` directly,
   which never has that field — this would not have compiled. Fixed by
   including `trainable_count` in the returned object.
3. **Trainable-gap undercount for any resume with >1 job-specific skill.**
   `computeReadinessScore` finds its job-specific skill list with
   `matchedByCategory.find(cat => cat.category === 'job_specific')` —
   `.find()` returns only the *first* match. The route as specified built
   `matchedByCategory` with **one entry per skill** (not one entry per
   category), so `.find()` would silently see only the first job-specific
   skill and ignore every other one when computing `trainable_gaps` and
   `hiring_probability`. Fixed by grouping skills by category in the route
   before calling `computeReadinessScore` (see the comment in
   `app/api/skill-gap/strategic/route.ts`), and added a regression test
   in `lib/utils/skill-readiness-score.test.ts` covering 3+ job-specific
   skills.
4. **No input validation / inconsistent error shape.** The route as
   specified destructured `request.json()` directly with no schema
   validation, and returned bare `{ error: string }` bodies with no
   `code` field. This repo's established convention (see `docs/api.md`,
   `CLAUDE.md`) is Zod validation on every route plus `{ error, code }`
   responses with ownership checks folded into 404. Fixed to reuse the
   existing `analyzeGapSchema` (identical shape: `{ resume_id, jd_id }`)
   and to match the error-code convention. The catch-all error is `500
   INTERNAL_ERROR`, not `502 AI_ERROR` as in similar-looking routes —
   this endpoint makes no AI call, so an `AI_ERROR` code would be
   misleading if it ever fired.

## Not done in this session

**The new `SkillGapAnalysisStrategic` component is not wired into any
page.** No step in the originating task connected it to
`app/(dashboard)/review/page.tsx` or anywhere else — the component, API
route, and scoring logic all exist and compile, but there is currently no
way for a user to see this feature in the running app. Someone needs to
decide where it belongs in the review flow (replacing the existing gap
analysis display? alongside it?) before this is user-facing.

## Implementation

- **Backend:** `lib/utils/skill-categories.ts` (categorization + trainability
  heuristics), `lib/utils/skill-readiness-score.ts` (weighted scoring +
  hiring probability), `lib/utils/competitive-advantages.ts` (CV-text
  pattern detection), `lib/types/skills.ts` (shared types)
- **API:** `POST /api/skill-gap/strategic`
- **Frontend:** `components/SkillGapAnalysisStrategic.tsx` (built, not yet
  mounted anywhere)
- **Tests:** `lib/utils/skill-readiness-score.test.ts`

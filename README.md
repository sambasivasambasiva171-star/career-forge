# career-forge
ai powered cv with networking suggestions

## Acceptance Tests

### Determinism & Match Score

**Manual test (until integration test DB is available):**

1. **Determinism**: Upload resume → Add JD → Generate CV → Generate again
   - Expected: Second generation is instant (cached), outputs are byte-identical
   - Verify in Vercel logs: first run shows AI call, second shows cache hit

2. **Match Score**: After generation, check review page
   - Expected: Color-coded ATS match banner (green ≥75%, yellow ≥50%, red <50%)
   - Check database: `generated_documents.content_json.match_score` is populated

3. **No Hallucination**: Generate twice for the same resume+JD
   - Expected: No fabricated companies/institutions in either output
   - Verify Vercel logs: [FACT GATE] messages show what was stripped (or nothing if clean)

Run these before each release to production.

## Freemium Model

### Quota Limits

- **Free Tier**: 3 CV generations per calendar month
- **Premium Tier**: Unlimited CV generations
- **Quotas reset**: First day of each calendar month (UTC)

### How It Works

1. User generates CV → `checkQuota()` verifies usage count (only for genuinely
   new generations — re-fetching an already-cached resume+JD pair is free)
2. Free tier at limit → returns 402 Payment Required
3. UI shows quota status: "2 of 3 CVs remaining this month"
4. When exhausted, "Upgrade to premium" button appears
5. Paid users see no quota warnings

### Database Schema

- `profiles.subscription_tier` (free/premium/enterprise, defaults to free)
- `generated_documents` filtered by `doc_type='resume'` and `created_at >= month_start`
- Quota reset is date-based: automatic on calendar month boundary, no cron needed

### Testing

Manual test:
1. Log in as free-tier user
2. Generate CV → see "2 of 3 remaining"
3. Generate CV → see "1 of 3 remaining"
4. Generate CV → see "0 of 3 remaining, upgrade prompt"
5. Fourth attempt → 402 Payment Required

Vercel logs show: `[QUOTA] User {id} exhausted free tier quota (3/3)`

## Six-Second Scan Simulation

**The Problem**: Hiring managers spend ~6 seconds initially scanning a CV. They see your name,
summary, and the title + top bullets of your most recent role. Everything else is typically
invisible until they actively scroll or decide to read more.

**The Solution**: Career-forge enforces and visualizes this constraint.

### How It Works

1. **Enforcement (Code Level)**:
   - Summary capped at 40 words
   - Most recent role: max 5 bullets
   - Older roles: max 3 bullets each
   - These limits are applied during CV generation

2. **Visualization (UI Level)**:
   - "Preview 6-Second Scan" button on the review page
   - Shows: name + summary + recent role title + top 2–3 bullets
   - Grays out: education, older roles, skills, certifications
   - Insight banner: explains why this matters

3. **Outcome**:
   - You see exactly what hiring managers see in the first 6 seconds
   - Reinforces the importance of a strong summary and top accomplishments
   - Guides you to rewrite with impact

### Example: Before vs. After Scan

**Full CV** (what hiring manager *can* see if they scroll): 9 sections, education, 3 roles, 20+ skills, certifications

**6-Second Scan** (what hiring manager *does* see): Name, summary (40 words), recent role title, top 3 bullets

The scan preview is read-only. To edit, click "Edit Full CV" to return to the full editor.

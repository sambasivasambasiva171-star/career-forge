# Troubleshooting Guide

Check `GET /api/health` first for any production issue — it reports
Supabase and NVIDIA NIM config status in one call and will usually point
you at the right section below.

## "Database connection failed" / `/api/health` shows `supabase: down`

**Likely causes, in order of likelihood:**
1. Supabase free-tier project auto-paused from inactivity — check the
   Supabase dashboard for a "paused" state and resume it (see
   `docs/deployment-runbook.md`, "Supabase free-tier pause risk").
2. `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is wrong
   or missing in the deployment's environment variables.
3. Supabase itself is having an outage — check Supabase's own status page.

## `/api/health` shows `nvidia_nim: down`

This specifically means `NVIDIA_NIM_API_KEY` is not set in the
environment — the health check only verifies configuration, not live API
reachability (see the comment in `app/api/health/route.ts` for why: no
free lightweight NIM health endpoint exists to probe, and a real
completion call costs money). If the key IS set but AI calls are still
failing, that's a different issue — see the next section.

## "Failed to generate resume" / `AI_ERROR` code, 502 status

The health check won't catch this since it doesn't make a real completion
call. Check:
1. Is `NVIDIA_NIM_API_KEY` valid (not just present)? An expired/revoked
   key fails at call time, not at startup.
2. Check the `[AI_USAGE]` and `Resume generation AI error:` log lines in
   Vercel's function logs for the actual thrown error — the 502 response
   body intentionally doesn't leak internals to the client.
3. Retry once — transient NIM rate limits or timeouts are possible and
   aren't distinguishable from a real outage without checking logs.

## `429` / `RATE_LIMITED` responses

Two independent causes — check which one by the error message text:
- **"Too many requests"** (generic) — the per-IP Redis limiter in
  `middleware.ts` tripped. Resets on its own (100/hour for AI routes,
  30/min for general API, per `lib/rate-limit.ts`).
- **"Upload limit reached... Free tier: 10 uploads/hour"** — the
  per-user upload limit in `app/api/resume/parse/route.ts` tripped. Only
  applies to free-tier accounts; resets on a rolling hour, not a fixed
  clock boundary.

If the Redis limiter itself is unreachable, `middleware.ts` **fails open**
(logs the error, lets the request through) rather than blocking all
traffic — so a Redis outage degrades protection, it doesn't take the app
down. Check for `Rate limit check failed:` in logs if you suspect this.

## "Resume not found" (404) when the resume should exist

Since the security fix in this session, a 404 here means one of two
things, and the response deliberately doesn't tell you which:
1. The resume ID genuinely doesn't exist (typo, deleted record).
2. The resume exists but belongs to a different user than the one making
   the request.

If you're debugging this as a developer (not diagnosing a real security
concern), query the `resumes` table directly by ID in the Supabase
dashboard to tell the two cases apart — the API response won't.

## Generated CV has missing or unexpected content

Check Vercel logs for `[FACT GATE] Removed fabricated content:` — this
means `lib/utils/fact-check.ts` stripped something not grounded in the
source resume or validated additions. If content that *should* be there
got stripped, the source resume's `parsed_json` likely doesn't actually
contain it — check `resumes.parsed_json` and `validated_additions`
directly in the database before assuming the fact gate is over-aggressive.

## App feels slow (generation taking much longer than 2–5s)

1. Check the `[AI_USAGE]` log line's `Duration` field — if the NIM call
   itself is slow, that's an upstream issue, not this app's.
   Retry once (cold-start-like latency on the first call is possible).
2. Check the deployment platform's own latency dashboard for
   infrastructure-side slowness unrelated to the AI call.

## Debugging locally

```bash
npm run dev
curl http://localhost:3000/api/health
```

Check `.env.local` has all required variables from `.env.local.example` —
a missing `KV_REST_API_URL`/`KV_REST_API_TOKEN` will make `middleware.ts`
throw on the very first request, which looks like the whole app is broken
when it's actually just a missing rate-limiter credential.

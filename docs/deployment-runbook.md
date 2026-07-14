# Deployment Runbook

## Prerequisites
- A Vercel project connected to the `career-forge` GitHub repo
  (`github.com/sambasivasambasiva171-star/career-forge` — confirm this
  matches whichever Vercel project you're actually deploying, since none
  was verified from this environment)
- A Supabase project, with `NEXT_PUBLIC_SUPABASE_URL` /
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` set as
  Vercel environment variables (never committed — see `.env.local.example`)
- An NVIDIA NIM API key (`NVIDIA_NIM_API_KEY`)
- Upstash Redis credentials (`KV_REST_API_URL`, `KV_REST_API_TOKEN`) — the
  rate limiter in `middleware.ts` will throw on startup without these

`vercel.json` in this repo just declares `"framework": "nextjs"` — there's
no custom build/deploy config to maintain beyond environment variables.

## Deploy process

1. **Local checks before pushing:**
   ```bash
   npx tsc --noEmit
   npm run build
   npm test
   ```
   All three must pass. `npm run build` catches issues `tsc --noEmit` alone
   won't (e.g. route handler export shape).

2. **Push to the branch Vercel watches** (typically `main`):
   ```bash
   git push origin main
   ```

3. **Vercel auto-deploys.** Confirm via the Vercel dashboard for this
   project — this doc can't give you a live deployment URL since none was
   verified from this environment; check your own project settings.

4. **Verify the deploy** by hitting the health check on the actual deployed
   URL:
   ```bash
   curl https://<your-deployment-domain>/api/health
   # Expect: { "status": "ok", "services": { "supabase": "up", "nvidia_nim": "up" } }
   ```
   A `503` with `"status": "degraded"` means something in `services` is
   down — see `docs/troubleshooting.md`.

## Rollback

Vercel keeps prior deployments. The fastest rollback is promoting the
previous deployment to production from the Vercel dashboard (Deployments →
select the last known-good one → "Promote to Production") — this doesn't
require a git revert and is close to instant.

If you need the git history to match (e.g. the bad commit must not stay on
`main`):
```bash
git revert HEAD
git push origin main
```
This triggers a new deploy of the reverted state. Prefer `revert` over
`reset --hard` + force-push — reverting preserves history and doesn't
rewrite a branch others may have pulled.

## Database migrations

**As of 2026-07-14, there is no Supabase CLI installed and no project
linked in this repo's development environment.** Migrations exist as SQL
files in `supabase/migrations/` but must be applied by someone with actual
Supabase project access:
```bash
supabase link --project-ref <your-project-ref>
supabase db push
```
Per the database-designer safety rules: **take a backup before running
this**, and confirm the migration is additive (the pending
`20260714150000_add_quota_index.sql` is — it only adds an index, no data
is touched).

## Monitoring

- **Uptime:** poll `GET /api/health` on an interval (e.g. every 5 minutes)
  from an external uptime monitor. No specific tool is set up yet — pick
  one and verify its current free-tier limits before committing (limits
  change; don't trust a remembered number).
- **Errors:** no error-tracking service (Sentry or similar) is integrated
  yet. Vercel's own function logs are the only error visibility today, and
  they don't persist indefinitely — check Vercel's current log retention
  window before relying on it for post-incident review.
- **Cost:** `[AI_USAGE]` log lines in `lib/ai/client.ts` report token counts
  and an UNVERIFIED cost estimate per call — useful for spotting a runaway
  loop, not for actual billing reconciliation.

## Supabase free-tier pause risk

Supabase's free tier has historically auto-paused projects after a period
of inactivity — verify the current inactivity window against Supabase's
docs before relying on any specific number here, since this changes.
**Symptom:** `/api/health` returns `503` with `services.supabase: "down"`
and an error mentioning the project being unreachable, even though nothing
in the code changed.

**Fix:** either upgrade to a paid Supabase tier, or set up a scheduled
job (Vercel Cron, or an external uptime pinger) that hits `/api/health` (or
any Supabase-touching endpoint) frequently enough to stay under the
inactivity threshold. Neither is currently configured — someone with
Supabase project access needs to make this call before this app is left
unattended for an extended period.

## Incident order

1. Restore service first (usually: roll back to the last known-good
   deployment) — don't debug on a broken production while users are
   affected.
2. Preserve evidence — copy the relevant Vercel logs before they roll off
   retention.
3. Diagnose using `docs/troubleshooting.md`.
4. Ship the proper fix, verified locally first.
5. Add a line to `docs/tech-debt.md` if the incident revealed a gap worth
   tracking.

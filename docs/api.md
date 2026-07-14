# API Reference

Version-stamped: 2026-07-14, against the routes in `app/api/` as of this
date. If a route's actual behavior ever diverges from this doc, trust the
code and fix this file.

## Overview

REST-ish, JSON request/response, authenticated via the Supabase session
cookie set by `@supabase/ssr`. There is no separate API key or bearer
token — if you're logged into the app in a browser, your session cookie
authenticates these routes.

## Conventions

- All error responses have the shape `{ "error": string, "code": string }`
  (some also include extra fields, e.g. `quota` on 402s).
- Ownership checks that fail return **404**, not 403 — a resume or job
  description belonging to another user looks identical to one that
  doesn't exist. This is deliberate (see `docs/tech-debt.md`).
- All `POST` routes below require an authenticated session; unauthenticated
  requests get `401 { code: "UNAUTHORIZED" }`.

### Error codes

| Code | HTTP status | Meaning |
|---|---|---|
| `UNAUTHORIZED` | 401 | No valid Supabase session |
| `INVALID_INPUT` | 400 / 422 | Body failed Zod validation, or a precondition wasn't met (e.g. resume not parsed yet) |
| `NOT_FOUND` | 404 | Record doesn't exist, or exists but isn't owned by the caller |
| `QUOTA_EXHAUSTED` | 402 | Free tier hit its monthly CV generation limit |
| `RATE_LIMITED` | 429 | Per-IP (middleware) or per-user (upload) rate limit hit |
| `RESUME_NOT_PARSED` | 422 | Resume record exists but hasn't finished AI parsing |
| `AI_ERROR` | 502 | NVIDIA NIM call failed, timed out, or returned an unexpected shape |
| `INTERNAL_ERROR` | 500 | Database write failed, storage unreachable, etc. |

## Rate limiting

Two independent layers:
1. **Per-IP, all AI routes** (`middleware.ts` + `lib/rate-limit.ts`, Upstash
   Redis): 100 requests/hour on AI routes, 30/min on other API routes,
   10/15min on auth POSTs. Applies regardless of login state.
2. **Per-user, uploads only** (`app/api/resume/parse/route.ts`): free-tier
   accounts are capped at 10 uploads/hour on top of the IP limit above.

## Endpoints

### POST /api/resume/parse
Extract structured resume data from an uploaded PDF or manual text entry.

**Body:** `{ resume_id: string }`
**200:** `{ success: true, parsed_json: { contact, work_experience, skills, ... } }`
**Errors:** 400/422 `INVALID_INPUT`, 401, 404, 429 `RATE_LIMITED` (free tier, 10/hour), 502 `AI_ERROR`

### POST /api/resume/generate
Tailor a resume to a job description; returns a cached variant if one
exists for this resume+JD pair unless `regenerate: true`.

**Body:** `{ resume_id: string, jd_id: string, preflight_facts?: string[], questionnaire_skipped?: boolean, regenerate?: boolean }`
**200:** `{ success: true, resume: object, document_id: string, match_score: number, match_missing_keywords: string[], quota: { used, limit, remaining, resetDate }, cached?: true }`
**Errors:** 400 `INVALID_INPUT`/`RESUME_NOT_PARSED`, 401, 402 `QUOTA_EXHAUSTED`, 404, 502 `AI_ERROR`

### POST /api/jd/analyze
Gap analysis: which JD skills are matched / partially matched / missing
from the resume.

**Body:** `{ resume_id: string, jd_id: string }`
**200:** `{ success: true, analysis: { matched_skills, missing_skills, partial_skills } }`
**Errors:** 400, 401, 404, 502 `AI_ERROR`

### POST /api/jd/preflight
Pre-screening check surfacing likely JD requirements/questions before
applying.

**Body:** `{ jd_id: string }`
**200:** `{ success: true, checks: Array<{ type, jd_requirement, guidance }> }`
**Errors:** 400, 401, 404, 502 `AI_ERROR`

### POST /api/questionnaire/generate
Generate screening questions targeting the gaps found by `/api/jd/analyze`.

**Body:** `{ resume_id: string, jd_id: string }`
**200:** `{ success: true, questions: Array<{ id, target_skill, question_text }>, persona: string }`
**Errors:** 400 (incl. "gap analysis not run yet"), 401, 404, 502 `AI_ERROR`

### POST /api/questionnaire/extract-skill
Extract a named skill from a free-text answer and rewrite the associated
bullet.

**Body:** `{ jd_id: string, existing_bullet?: string, question: string, answer: string }`
**200:** `{ success: true, skill_identified: string, rewritten_bullet: string }`
**Errors:** 400, 401, 404, 502 `AI_ERROR`

### POST /api/skills/validate
Merge user-approved skill additions into a resume's `validated_additions`
so later generations can draw on them without the AI fabricating them.

**Body:** `{ resume_id: string, approved: object[] }`
**200:** `{ success: true, validated_additions: object[] }`
**Errors:** 400, 401, 404

### POST /api/cover-letter/generate
Generate a cover letter tailored to a JD, grounded in an already-generated
resume variant.

**Body:** `{ resume_id: string, jd_id: string, cv_document_id: string }`
**200:** `{ success: true, cover_letter_text: string, document_id: string }`
**Errors:** 400, 401, 404 (JD or source resume), 502 `AI_ERROR`

### POST /api/networking/suggest
Generate networking outreach suggestions (LinkedIn, alumni, placement
cell, referral) based on the user's latest generated resume and a JD.

**Body:** `{ jd_id: string }`
**200:** `{ success: true, suggestions: Array<{ category, suggestion_text }> }`
**Errors:** 400 (incl. "no resume generated yet"), 401, 404, 502 `AI_ERROR`

### GET /api/resume/pdf?document_id=...
Render a generated resume as a downloadable PDF.
**Errors:** 400, 401, 404, 500

### GET /api/cover-letter/pdf?document_id=...
Render a generated cover letter as a downloadable PDF.
**Errors:** 400, 401, 404, 500

### POST /api/account/update
Update the caller's own profile (persona, location, job market, etc.).
**Errors:** 400, 401, 500

### POST /api/account/delete
Permanently delete the caller's own account via the Supabase admin API.
**Errors:** 401, 500 (if `SUPABASE_SERVICE_ROLE_KEY` isn't configured)

### GET /api/health
Uptime/monitoring endpoint — no auth required. See `docs/deployment-runbook.md`.
**200:** `{ status: "ok", services: { supabase: "up", nvidia_nim: "up" } }`
**503:** `{ status: "degraded", services, errors: string[] }`

## Not covered here

`POST /api/resume/pdf-from-data` is marked `DEPRECATED` in its own file
header (superseded by client-side PDF rendering) and is intentionally
omitted — don't build against it.

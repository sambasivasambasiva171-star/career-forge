# UI/UX Validation Checklist

Manual checklist — nothing here has been automated or verified against a
running browser this session (no browser tooling was available). Treat
every item as **[VERIFY]** until someone actually clicks through it.

Screens referenced: `app/(dashboard)/review/page.tsx`, `app/(dashboard)/upload/page.tsx`,
`app/(dashboard)/job-description/page.tsx`, `app/(dashboard)/dashboard/page.tsx`.

## Desktop (1920px)
- [ ] Review page layout doesn't break; match score banner and 6-second
      scan preview (documented in `README.md`) render without overlap
- [ ] Editable CV preview text doesn't stretch to an uncomfortable line
      length at full width

## Tablet (768px)
- [ ] Multi-column sections collapse to a single column where needed
- [ ] All interactive controls are touch-sized (48px minimum target)

## Mobile (375px — iPhone SE class)
- [ ] CV preview never requires horizontal scrolling
- [ ] Quota status ("2 of 3 CVs remaining this month") fits without
      wrapping awkwardly
- [ ] Primary action per screen (upload, generate, download) stays the
      most visually prominent element at this width

## Empty states
- [ ] No resumes uploaded yet → clear "Upload your first resume" CTA, not
      a blank list
- [ ] No job description added → "Add a job description to generate CVs"
- [ ] No generated CVs yet → "Generate your first tailored CV"

Per the UX/UI design principle "design for the busy, distracted,
first-time user" — an empty screen with no explanation is a design bug,
not a user error.

## Loading states
- [ ] CV generation (2–5s typical, per `README.md`'s acceptance criteria)
      shows a spinner/progress indicator, not a frozen button
- [ ] Match score calculation shows a loading badge rather than popping in
      instantly (the number needs a moment to feel earned/trustworthy)

## Accessibility (baseline, not exhaustive)
- [ ] Text contrast meets WCAG AA for body text and the match-score
      color coding (green/yellow/red) — color should not be the *only*
      signal (pair with text: "Strong match", "Partial match", "Weak match")
- [ ] Interactive elements are reachable and operable via keyboard alone

## Deferred to a later session (not blocking beta)

- Dark mode support
- Full responsive polish pass (collapsible sections, scroll hints) — see
  `docs/roadmap.md` Phase 2/3
- Automated visual regression testing (Playwright) — see `docs/qa-process.md`

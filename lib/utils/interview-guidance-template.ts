/**
 * Interview guidance is a diff explainer, not a content generator: every
 * claim it makes must be traceable to the user's actual original resume,
 * their actual tailored CV, or the actual job description text. It must
 * never invent an employer, a role, or a specific accomplishment the user
 * didn't provide — the app's whole anti-hallucination design (see
 * lib/utils/fact-check.ts) exists to strip exactly that kind of content
 * out of generated resumes, and this feature must not reintroduce it in a
 * different form.
 */

export interface ResumeSnapshot {
  summary: string | null
  skills: string[]
  work_experience: Array<{
    title: string
    company: string
    responsibilities: string[]
  }>
}

export interface RoleChange {
  title: string
  company: string
  before: string[]
  after: string[]
}

export interface CvDiff {
  summary_changed: boolean
  summary_before: string
  summary_after: string
  skills_added: string[]
  skills_removed: string[]
  role_changes: RoleChange[]
}

/**
 * Pure, deterministic comparison of the original resume against the
 * AI-tailored CV. Every field here is copied verbatim from one of the two
 * real documents — nothing is invented. Roles are matched by
 * title+company; a tailored role with no matching original (e.g. one that
 * was condensed away by removeIrrelevantRoles) is skipped rather than
 * guessed at.
 */
export function computeCvDiff(original: ResumeSnapshot, tailored: ResumeSnapshot): CvDiff {
  const summaryBefore = (original.summary ?? '').trim()
  const summaryAfter = (tailored.summary ?? '').trim()

  const norm = (s: string) => s.toLowerCase().trim()
  const originalSkills = new Set(original.skills.map(norm))
  const tailoredSkills = new Set(tailored.skills.map(norm))
  const skills_added = tailored.skills.filter(s => !originalSkills.has(norm(s)))
  const skills_removed = original.skills.filter(s => !tailoredSkills.has(norm(s)))

  const role_changes: RoleChange[] = []
  for (const tailoredRole of tailored.work_experience) {
    const originalRole = original.work_experience.find(
      r => norm(r.title) === norm(tailoredRole.title) && norm(r.company) === norm(tailoredRole.company)
    )
    if (!originalRole) continue

    const before = originalRole.responsibilities
    const after = tailoredRole.responsibilities
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      role_changes.push({ title: tailoredRole.title, company: tailoredRole.company, before, after })
    }
  }

  return {
    summary_changed: summaryBefore !== summaryAfter,
    summary_before: summaryBefore,
    summary_after: summaryAfter,
    skills_added,
    skills_removed,
    role_changes,
  }
}

export interface CvChangeExplained {
  section: string
  what_changed: string
  why: string
}

/**
 * Builds the deterministic "what changed" description for each diff item.
 * The "why" (which needs to reference the specific job description) is
 * filled in separately by the AI — see generateChangeReasons() in the API
 * route — so this function never has to invent anything either.
 */
export function describeChanges(diff: CvDiff): Array<{ section: string; what_changed: string; before: string; after: string }> {
  const items: Array<{ section: string; what_changed: string; before: string; after: string }> = []

  if (diff.summary_changed && diff.summary_after) {
    items.push({
      section: 'Professional Summary',
      what_changed: diff.summary_before
        ? 'Your summary was rewritten.'
        : 'A professional summary was added.',
      before: diff.summary_before || '(none)',
      after: diff.summary_after,
    })
  }

  if (diff.skills_added.length > 0 || diff.skills_removed.length > 0) {
    const parts: string[] = []
    if (diff.skills_added.length > 0) parts.push(`Added: ${diff.skills_added.join(', ')}`)
    if (diff.skills_removed.length > 0) parts.push(`Removed: ${diff.skills_removed.join(', ')}`)
    items.push({
      section: 'Skills',
      what_changed: parts.join(' — '),
      before: '(see removed list)',
      after: '(see added list)',
    })
  }

  for (const role of diff.role_changes) {
    items.push({
      section: `${role.title} — ${role.company}`,
      what_changed: `${role.after.length} bullet point${role.after.length === 1 ? '' : 's'} reworded.`,
      before: role.before.join('\n'),
      after: role.after.join('\n'),
    })
  }

  return items
}

/** Generic, honest interview-prep guidance — no fabricated personal claims. */
export const COMMON_QUESTION_TYPES: Array<{ type: string; guidance: string }> = [
  {
    type: 'Why do you want this role / why are you a fit?',
    guidance:
      "Connect one or two of your real strengths (see the competitive-advantages section) directly to specific requirements in the job description. Use your own words — don't recite a script.",
  },
  {
    type: 'Tell me about a time you solved a problem or handled a difficult situation.',
    guidance:
      'Pick a real example from your own work history. Structure it as: the situation, the action you took, and the outcome. Keep it specific and true to what actually happened — a rehearsed answer that doesn\'t match your real CV will be caught in follow-up questions.',
  },
  {
    type: 'Why should we hire you over other candidates?',
    guidance:
      "Lead with the core competencies you matched in your readiness analysis — those are the skills that are hardest to train, which is exactly what makes them worth mentioning first.",
  },
  {
    type: "You don't have direct experience with [a specific tool/system]. How will you catch up?",
    guidance:
      'Be honest that it\'s new to you, then point to a real, specific example of learning something quickly in a past role. Employers expect ramp-up time for job-specific tools; they\'re assessing whether you learn fast, not whether you already know everything.',
  },
]

export const INTERVIEW_DAY_CHECKLIST: string[] = [
  'Bring or have ready 2–3 copies of your CV (in case there are multiple interviewers).',
  'Re-read the job description shortly before the interview, and the CV changes above — you want your own wording to be second nature.',
  'Prepare 1–2 real examples from your work history that back up your strongest matched skills.',
  'Prepare 1–2 questions to ask them, e.g. "What does success in this role look like in the first few months?"',
  'Arrive (or join the call) a few minutes early.',
  'Bring a notepad — taking a note or two signals engagement.',
]

import { enforceUKSpelling } from '@/lib/utils/spelling'

const MONTH_MAP: Record<string, string> = {
  '01': 'January', '02': 'February', '03': 'March',
  '04': 'April', '05': 'May', '06': 'June',
  '07': 'July', '08': 'August', '09': 'September',
  '10': 'October', '11': 'November', '12': 'December',
}

function convertDate(date: string | null | undefined): string | null {
  if (!date) return null
  const isoMatch = date.match(/^(\d{4})-(\d{2})$/)
  if (isoMatch) {
    const month = MONTH_MAP[isoMatch[2]]
    return month ? `${month} ${isoMatch[1]}` : date
  }
  return date
}

export function normaliseDates(cv: Record<string, unknown>): Record<string, unknown> {
  const work = ((cv.work_experience as Array<Record<string, unknown>>) || []).map(exp => ({
    ...exp,
    start_date: convertDate(exp.start_date as string),
    end_date: convertDate(exp.end_date as string),
  }))

  const edu = ((cv.education as Array<Record<string, unknown>>) || []).map(e => ({
    ...e,
    start_date: convertDate(e.start_date as string),
    end_date: convertDate(e.end_date as string),
  }))

  return { ...cv, work_experience: work, education: edu }
}

/**
 * Enforce the 40-word summary rule in code.
 * Safe version: trims at sentence boundaries only — keeps the first two
 * sentences, or the first sentence if two still exceed 40 words. Never
 * rewrites or filters content (the previous content-filtering version was
 * disabled for making output worse).
 */
export function truncateSummary(
  cv: Record<string, unknown>
): Record<string, unknown> {
  const summary = cv.summary
  if (typeof summary !== 'string' || !summary.trim()) return cv

  const wordCount = (s: string) => s.trim().split(/\s+/).length
  if (wordCount(summary) <= 40) return cv

  const sentences = summary.match(/[^.!?]+[.!?]+/g) ?? [summary]
  let result = sentences.slice(0, 2).join(' ').trim()
  if (wordCount(result) > 40 && sentences.length > 1) {
    result = sentences[0].trim()
  }
  return { ...cv, summary: result }
}

/**
 * Six-second scan rule: a hiring manager skims, so no role may carry a
 * wall of bullets. Cap bullets per role (most recent role gets the most).
 */
export function capBullets(
  cv: Record<string, unknown>,
  firstRoleMax = 5,
  otherRolesMax = 3
): Record<string, unknown> {
  const work = (cv.work_experience as Array<Record<string, unknown>>) || []
  const capped = work.map((role, i) => {
    const bullets = (role.responsibilities as string[]) || []
    const max = i === 0 ? firstRoleMax : otherRolesMax
    return bullets.length > max ? { ...role, responsibilities: bullets.slice(0, max) } : role
  })
  return { ...cv, work_experience: capped }
}

const IRRELEVANT_INDUSTRIES = [
  'farm', 'farmer', 'agriculture', 'automotive', 'automobile',
  'car dealer', 'vehicle', 'manufacturing', 'factory',
  'construction', 'warehouse', 'logistics', 'driving',
  'security guard', 'cleaning', 'labourer', 'laborer',
]

const RELEVANT_INDUSTRIES = [
  'hotel', 'hospitality', 'restaurant', 'cafe', 'bar',
  'guest', 'customer service', 'retail', 'reception',
  'front desk', 'host', 'waiter', 'waitress', 'steward',
  'housekeeper', 'concierge', 'events', 'catering',
  'food', 'beverage', 'kitchen', 'chef', 'cook',
  'sales', 'support', 'admin', 'office', 'operations',
]

export function removeIrrelevantRoles(
  cv: Record<string, unknown>,
  jdText: string
): Record<string, unknown> {
  const work = (cv.work_experience as Array<Record<string, unknown>>) || []
  if (work.length <= 2) return cv

  const jdLower = jdText.toLowerCase()

  const isRelevant = (role: Record<string, unknown>): boolean => {
    const roleText = [
      role.title,
      role.company,
    ].join(' ').toLowerCase()

    // Explicitly irrelevant industries — exclude
    if (IRRELEVANT_INDUSTRIES.some(term => roleText.includes(term))) {
      return false
    }

    // Explicitly relevant — include
    if (RELEVANT_INDUSTRIES.some(term => roleText.includes(term))) {
      return true
    }

    // JD title match — include if role title words appear in JD
    const titleWords = ((role.title as string) || '')
      .toLowerCase().split(/\s+/).filter(w => w.length > 3)
    if (titleWords.some(w => jdLower.includes(w))) {
      return true
    }

    // Default: exclude if unclear
    return false
  }

  // Always keep most recent role
  const [first, ...rest] = work
  const relevant = rest.filter(isRelevant).slice(0, 2)

  // If fewer than 2 relevant found, pad with next most recent
  // to ensure at least 2 roles always show
  if (relevant.length < 1) {
    return { ...cv, work_experience: [first, ...rest.slice(0, 1)] }
  }

  return { ...cv, work_experience: [first, ...relevant] }
}

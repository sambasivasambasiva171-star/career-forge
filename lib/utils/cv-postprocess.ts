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

export function truncateSummary(cv: Record<string, unknown>): Record<string, unknown> {
  if (!cv.summary || typeof cv.summary !== 'string') return cv

  // Remove sentences that mention visa sponsorship from summary
  // This belongs only in Additional Information, not the summary
  const sentences = cv.summary.split(/(?<=[.!?])\s+/)

  const FILLER_PHRASES = [
    'skilled in communication',
    'skilled in teamwork',
    'seeking opportunities to apply',
    'proven track record',
    'recognised for maintaining',
    'working effectively under pressure',
    'strong interpersonal',
    'contributing positively',
    'fast-paced environments',
    'professional standards',
    'supporting colleagues',
  ]

  const filtered = sentences.filter(s => {
    const lower = s.toLowerCase()
    if (lower.includes('visa')) return false
    if (lower.includes('sponsorship')) return false
    if (lower.includes('seeking')) return false
    if (FILLER_PHRASES.some(phrase => lower.includes(phrase))) return false
    return true
  })

  // Safety: if all sentences filtered out, keep the first one
  const cleanedSummary = filtered.length > 0
    ? filtered.join(' ').trim()
    : sentences[0]

  const words = cleanedSummary.trim().split(/\s+/)
  if (words.length <= 40) return { ...cv, summary: cleanedSummary }
  const truncated = words.slice(0, 40).join(' ').replace(/[,;]$/, '') + '.'
  return { ...cv, summary: truncated }
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

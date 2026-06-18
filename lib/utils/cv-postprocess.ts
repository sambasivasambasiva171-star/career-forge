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
  const words = cv.summary.trim().split(/\s+/)
  if (words.length <= 40) return cv
  const truncated = words.slice(0, 40).join(' ').replace(/[,;]$/, '') + '.'
  return { ...cv, summary: truncated }
}

export function removeIrrelevantRoles(
  cv: Record<string, unknown>,
  jdText: string
): Record<string, unknown> {
  const work = (cv.work_experience as Array<Record<string, unknown>>) || []
  if (work.length <= 2) return cv

  const jdLower = jdText.toLowerCase()

  const scored = work.map(role => {
    const text = [
      role.title,
      role.company,
      ...((role.responsibilities as string[]) || []),
    ].join(' ').toLowerCase()

    const words = text.split(/\s+/)
    const score = words.filter(w => w.length > 4 && jdLower.includes(w)).length
    return { role, score }
  })

  // Always keep the most recent role (index 0) regardless of score
  // Sort remaining by score, keep top 2
  const [first, ...rest] = scored
  const topRest = rest
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)

  const kept = [first, ...topRest]
    .sort((a, b) => scored.indexOf(a) - scored.indexOf(b))
    .map(s => s.role)

  return { ...cv, work_experience: kept }
}

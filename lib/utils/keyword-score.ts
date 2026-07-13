/**
 * Keyword match scoring — the number the ATS effectively computes.
 *
 * ATS shortlisting works on keyword overlap between the JD and the CV
 * (see knowledge docs: "it is about keywords — the keywords in the job
 * description must be in your CV"). This module extracts keywords from
 * any JD generically (no hardcoded industry list) and scores the final
 * CV against them, so the user sees the same match percentage a
 * recruiter's ATS would sort them by.
 */

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'you', 'your', 'our', 'are', 'will', 'this',
  'that', 'have', 'has', 'from', 'their', 'they', 'them', 'were', 'been',
  'being', 'not', 'but', 'all', 'any', 'can', 'could', 'should', 'would',
  'may', 'might', 'must', 'shall', 'about', 'into', 'over', 'under', 'more',
  'most', 'other', 'some', 'such', 'than', 'then', 'these', 'those', 'when',
  'where', 'which', 'while', 'who', 'whom', 'why', 'how', 'what', 'per',
  'able', 'well', 'work', 'working', 'role', 'job', 'position', 'candidate',
  'applicant', 'company', 'team', 'teams', 'join', 'looking', 'seeking',
  'required', 'requirements', 'requirement', 'desirable', 'essential',
  'responsibilities', 'responsibility', 'duties', 'duty', 'including',
  'include', 'includes', 'experience', 'experienced', 'years', 'year',
  'strong', 'good', 'excellent', 'skills', 'skill', 'ability', 'knowledge',
  'understanding', 'plus', 'bonus', 'benefits', 'salary', 'apply',
  'application', 'opportunity', 'ideal', 'successful', 'day', 'week',
])

/** Words that are meaningful as part of a bigram but not alone. */
const WEAK_ALONE = new Set(['data', 'management', 'service', 'support', 'system', 'systems', 'analysis', 'development', 'design', 'customer', 'project'])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#./ -]/g, ' ')
    .split(/\s+/)
    .map(t => t.replace(/^[./-]+|[./-]+$/g, '')) // strip edge punctuation, keep node.js / c++ intact
    .filter(t => t.length > 0)
}

/**
 * Extract the most important keywords from any job description.
 * Combines frequent unigrams (e.g. "sql", "python", "excel") and
 * frequent bigrams (e.g. "power bi", "customer service", "stock management").
 */
export function extractKeywordsGeneric(jdText: string, max = 20): string[] {
  if (!jdText) return []
  const tokens = tokenize(jdText)

  const uniCounts = new Map<string, number>()
  const biCounts = new Map<string, number>()

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.length >= 3 && !STOPWORDS.has(t)) {
      uniCounts.set(t, (uniCounts.get(t) ?? 0) + 1)
    }
    if (i + 1 < tokens.length) {
      const a = tokens[i]
      const b = tokens[i + 1]
      if (a.length >= 3 && b.length >= 2 && !STOPWORDS.has(a) && !STOPWORDS.has(b)) {
        biCounts.set(`${a} ${b}`, (biCounts.get(`${a} ${b}`) ?? 0) + 1)
      }
    }
  }

  // Bigrams appearing 2+ times are strong domain terms; take them first.
  const bigrams = [...biCounts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((x, y) => y[1] - x[1])
    .map(([k]) => k)

  const bigramWords = new Set(bigrams.flatMap(b => b.split(' ')))

  const unigrams = [...uniCounts.entries()]
    .filter(([w, c]) => c >= 2 && !bigramWords.has(w) && !WEAK_ALONE.has(w))
    .sort((x, y) => y[1] - x[1])
    .map(([k]) => k)

  return [...bigrams, ...unigrams].slice(0, max)
}

export interface MatchScore {
  score: number // 0–100
  matched: string[]
  missing: string[]
}

/** Score the final CV JSON against JD keywords the way an ATS would. */
export function computeMatchScore(cv: unknown, jdText: string): MatchScore {
  const keywords = extractKeywordsGeneric(jdText)
  if (keywords.length === 0) return { score: 0, matched: [], missing: [] }

  const cvText = JSON.stringify(cv ?? {}).toLowerCase().replace(/[^a-z0-9+#./ -]/g, ' ').replace(/\s+/g, ' ')

  const matched: string[] = []
  const missing: string[] = []
  for (const k of keywords) {
    if (cvText.includes(k)) matched.push(k)
    else missing.push(k)
  }

  return {
    score: Math.round((matched.length / keywords.length) * 100),
    matched,
    missing,
  }
}

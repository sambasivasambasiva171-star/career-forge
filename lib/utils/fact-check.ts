/**
 * Fact gate — anti-hallucination enforcement in code.
 *
 * The generation prompt forbids inventing facts, but a prompt is a request,
 * not a guarantee. This module verifies that every entity in the generated
 * CV is grounded in the candidate's actual source data, and strips anything
 * that is not. Grounding sources: the parsed source resume, the user-approved
 * validated additions, and the preflight facts the user confirmed.
 *
 * Strategy: conservative entity-level stripping.
 * - A work role whose company does not appear in the source is fabricated → removed.
 * - An education entry whose institution does not appear in the source → removed.
 * - A certification not present in any grounding source → removed.
 * Titles, bullets, and phrasing are allowed to be rewritten (that is the
 * product's job); the anchor entities are not.
 */

export interface FactCheckResult {
  cv: Record<string, unknown>
  removed: string[]
}

function normalise(s: unknown): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** True if needle (or its significant words) appears in the haystack text. */
function isGrounded(needle: string, haystack: string): boolean {
  const n = normalise(needle)
  if (!n) return false
  if (haystack.includes(n)) return true
  // Fall back to word-level match: all significant words (>3 chars) present.
  const words = n.split(' ').filter(w => w.length > 3)
  if (words.length === 0) return haystack.includes(n)
  return words.every(w => haystack.includes(w))
}

export function factCheckResume(
  generated: Record<string, unknown>,
  sourceResume: unknown,
  validatedAdditions: unknown[],
  preflightFacts: string[]
): FactCheckResult {
  const groundingText = normalise(
    JSON.stringify(sourceResume ?? {}) +
      ' ' +
      JSON.stringify(validatedAdditions ?? []) +
      ' ' +
      (preflightFacts ?? []).join(' ')
  )

  const removed: string[] = []

  const work = ((generated.work_experience as Array<Record<string, unknown>>) || []).filter(role => {
    const company = String(role.company ?? '')
    if (!company) return true
    if (isGrounded(company, groundingText)) return true
    removed.push(`work_experience: "${role.title}" at "${company}" (company not in source data)`)
    return false
  })

  const education = ((generated.education as Array<Record<string, unknown>>) || []).filter(entry => {
    const institution = String(entry.institution ?? '')
    if (!institution) return true
    if (isGrounded(institution, groundingText)) return true
    removed.push(`education: "${entry.degree}" at "${institution}" (institution not in source data)`)
    return false
  })

  const certifications = ((generated.certifications as string[]) || []).filter(cert => {
    if (isGrounded(cert, groundingText)) return true
    removed.push(`certification: "${cert}" (not in source data)`)
    return false
  })

  return {
    cv: { ...generated, work_experience: work, education, certifications },
    removed,
  }
}

const BANNED_SKILLS = new Set([
  // Soft skills — no ATS value
  'fast learner', 'quick learner', 'team player', 'teamwork',
  'teamwork & collaboration', 'hard working', 'hardworking',
  'dedicated', 'motivated', 'self-motivated', 'self-starter',
  'adaptability', 'flexibility', 'reliable', 'reliability',
  'punctuality', 'reliability & punctuality', 'professional conduct',
  'work ethic', 'attention to detail', 'interpersonal skills',
  'communication skills', 'communication', 'critical thinking',
  'time management', 'organisation skills', 'organizational skills',
  'multi-tasking', 'multitasking', 'working under pressure',
  'fast-paced environment', 'problem solving', 'problem-solving',
  // Vague filler
  'willingness to learn', 'eagerness to learn', 'positive attitude',
  'detail-oriented', 'results-driven', 'goal-oriented',
])

const SYNONYM_GROUPS = [
  [
    'customer service', 'customer-facing operations',
    'customer complaint resolution', 'guest service recovery',
    'customer relations', 'client service', 'client relations',
  ],
  [
    'crisis management', 'crisis management & staff mobilization',
    'incident management',
  ],
  [
    'food hygiene', 'food safety', 'food & beverage',
  ],
]

/**
 * Post-processes AI-generated skills array:
 * 1. Removes banned soft skills
 * 2. Deduplicates synonyms (keeps first match per group)
 * 3. Enforces 8-10 skill cap
 * 4. Normalises to title case
 */
export function filterSkills(
  skills: string[],
  jdText?: string
): string[] {
  if (!skills || skills.length === 0) return []

  // Step 1 — remove banned skills (case-insensitive)
  const filtered = skills.filter(
    skill => !BANNED_SKILLS.has(skill.toLowerCase().trim())
  )

  // Step 2 — deduplicate synonyms
  // For each synonym group, keep only the first skill found
  const usedGroups = new Set<number>()
  const deduped = filtered.filter(skill => {
    const lower = skill.toLowerCase().trim()
    for (let i = 0; i < SYNONYM_GROUPS.length; i++) {
      if (SYNONYM_GROUPS[i].includes(lower)) {
        if (usedGroups.has(i)) return false // duplicate group
        usedGroups.add(i)
        return true
      }
    }
    return true // not in any synonym group — keep it
  })

  // Step 3 — enforce 8-10 cap
  // If over 10: trim to 10 (keep first 10 — AI already priority-ordered)
  // If under 8: return as-is (can't invent skills)
  const capped = deduped.slice(0, 10)

  // Step 4 — normalise to title case
  return capped.map(skill =>
    skill.trim().replace(/\b\w/g, c => c.toUpperCase())
  )
}

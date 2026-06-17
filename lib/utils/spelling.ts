// UK spelling safety net — backstops the AI prompt instruction for language_variant "uk_english".
// Excludes entries that are context-dependent in tech resumes (e.g. "program"/"license" are
// also valid UK terms — "software program", "to license" — so blind replacement would corrupt them).
const UK_SPELLING_MAP: Record<string, string> = {
  optimization: 'optimisation',
  optimized: 'optimised',
  optimizing: 'optimising',
  organize: 'organise',
  organized: 'organised',
  organizing: 'organising',
  organization: 'organisation',
  analyze: 'analyse',
  analyzed: 'analysed',
  analyzing: 'analysing',
  standardize: 'standardise',
  standardized: 'standardised',
  recognize: 'recognise',
  recognized: 'recognised',
  utilize: 'utilise',
  utilized: 'utilised',
  utilizing: 'utilising',
  utilization: 'utilisation',
  prioritize: 'prioritise',
  prioritized: 'prioritised',
  digitalize: 'digitalise',
  digitalized: 'digitalised',
  specialize: 'specialise',
  specialized: 'specialised',
  color: 'colour',
  favor: 'favour',
  behavior: 'behaviour',
  labor: 'labour',
  center: 'centre',
  defense: 'defence',
  offense: 'offence',
  catalog: 'catalogue',
  dialog: 'dialogue',
}

export function enforceUKSpelling(text: string): string {
  let result = text
  for (const [us, uk] of Object.entries(UK_SPELLING_MAP)) {
    const regex = new RegExp(`\\b${us}\\b`, 'gi')
    result = result.replace(regex, (match) => {
      if (match[0] === match[0].toUpperCase()) {
        return uk.charAt(0).toUpperCase() + uk.slice(1)
      }
      return uk
    })
  }
  return result
}

export function applyUKSpellingDeep<T>(value: T): T {
  if (typeof value === 'string') {
    return enforceUKSpelling(value) as T
  }
  if (Array.isArray(value)) {
    return value.map((item) => applyUKSpellingDeep(item)) as T
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      result[key] = applyUKSpellingDeep(val)
    }
    return result as T
  }
  return value
}

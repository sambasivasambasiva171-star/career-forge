export type LanguageVariant = 'uk_english' | 'us_english'

export function deriveLanguageVariant(location: string | null): LanguageVariant {
  if (!location) return 'us_english'

  const normalized = location.toLowerCase()
  const ukIndicators = ['uk', 'united kingdom', 'england', 'scotland', 'wales', 'northern ireland', 'london', 'manchester', 'birmingham', 'glasgow', 'edinburgh', 'liverpool', 'leeds', 'bristol']

  if (ukIndicators.some((indicator) => normalized.includes(indicator))) {
    return 'uk_english'
  }

  return 'us_english'
}

export function deriveDocumentTitle(languageVariant: LanguageVariant): string {
  return languageVariant === 'uk_english' ? 'Curriculum Vitae' : 'Resume'
}

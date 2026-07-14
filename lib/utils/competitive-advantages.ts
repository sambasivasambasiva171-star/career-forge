export interface CompetitiveAdvantage {
  title: string
  description: string
  cvEvidence: string
  relevance: 'critical' | 'high' | 'medium'
}

export function detectCompetitiveAdvantages(
  cvText: string,
  jdText: string
): CompetitiveAdvantage[] {
  const advantages: CompetitiveAdvantage[] = []
  const cvLower = cvText.toLowerCase()
  const jdLower = jdText.toLowerCase()

  if (
    (cvLower.includes('crisis') ||
      cvLower.includes('emergency') ||
      cvLower.includes('shortage') ||
      cvLower.includes('failure')) &&
    (jdLower.includes('pressure') || jdLower.includes('incident') || jdLower.includes('manage'))
  ) {
    advantages.push({
      title: 'Crisis Management Experience',
      description:
        'You have proven experience handling crises under pressure. Most candidates lack this demonstrated ability.',
      cvEvidence: 'Work experience section',
      relevance: 'critical',
    })
  }

  const customerRoles = ['chef', 'steward', 'sales', 'customer service', 'hospitality'].filter(
    role => cvLower.includes(role)
  )
  if (customerRoles.length >= 2 && jdLower.includes('customer')) {
    advantages.push({
      title: 'Multiple Customer-Facing Contexts',
      description: `You've worked with customers in ${customerRoles.length} different contexts. This breadth is rare and valuable.`,
      cvEvidence: 'Work experience section',
      relevance: 'high',
    })
  }

  const roleChangeCount = (cvText.match(/WORK EXPERIENCE|—.*–/g) ?? []).length
  if (roleChangeCount >= 3) {
    advantages.push({
      title: 'Proven Fast Learner',
      description: `You've held ${roleChangeCount}+ different roles, showing adaptability and learning ability.`,
      cvEvidence: 'Work experience section',
      relevance: 'high',
    })
  }

  if (cvLower.includes('msc') || cvLower.includes('master') || cvLower.includes('diploma')) {
    advantages.push({
      title: 'Ongoing Education & Growth Mindset',
      description:
        'Pursuing advanced education shows intellectual rigor and commitment to growth.',
      cvEvidence: 'Education section',
      relevance: 'medium',
    })
  }

  if (cvLower.includes('100%') || cvLower.includes('zero') || cvLower.includes('increased')) {
    advantages.push({
      title: 'Results-Driven Achievements',
      description: 'Your resume shows specific, quantified achievements.',
      cvEvidence: 'Work experience bullets',
      relevance: 'medium',
    })
  }

  return advantages
}

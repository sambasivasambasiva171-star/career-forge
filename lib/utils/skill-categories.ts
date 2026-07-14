import { SkillMatch } from '@/lib/types/skills'

export function categorizeSkill(skill: string, jobContext: string): SkillMatch['category'] {
  const coreCompetencies = [
    'problem solving',
    'communication',
    'teamwork',
    'collaboration',
    'leadership',
    'critical thinking',
    'adaptability',
    'resilience',
    'working under pressure',
    'pressure',
    'stress management',
    'emotional intelligence',
    'conflict resolution',
    'customer service',
    'interpersonal skills',
    'time management',
    'reliability',
    'responsibility',
    'professionalism',
    'work ethic',
  ]

  const transferableSkills = [
    'customer-facing',
    'customer interaction',
    'sales',
    'operations',
    'process management',
    'project coordination',
    'system navigation',
    'data analysis',
    'reporting',
    'documentation',
    'training',
    'mentoring',
    'crisis management',
    'event management',
    'guest service',
    'staff mobilization',
  ]

  const baselineSkills = [
    'honesty',
    'integrity',
    'literacy',
    'numeracy',
    'punctuality',
    'attendance',
    'digital literacy',
    'device confidence',
    'learning ability',
    'flexibility',
  ]

  const skillLower = skill.toLowerCase()

  if (coreCompetencies.some(core => skillLower.includes(core))) {
    return 'core_competency'
  }

  if (transferableSkills.some(trans => skillLower.includes(trans))) {
    return 'transferable'
  }

  if (baselineSkills.some(base => skillLower.includes(base))) {
    return 'baseline'
  }

  return 'job_specific'
}

export function isTrainable(skill: string, jdText: string): boolean {
  const trainingIndicators = [
    'training provided',
    "we'll provide",
    'we provide',
    "we'll teach",
    'we train',
    'learn on the job',
    'on-the-job training',
    'no experience necessary',
    'experience not required',
  ]

  const jdLower = jdText.toLowerCase()
  const hasTrainingLanguage = trainingIndicators.some(indicator =>
    jdLower.includes(indicator)
  )

  const jobSpecificPatterns = [
    'system',
    'software',
    'platform',
    'tool',
    'procedure',
    'protocol',
    'gate',
    'ticket',
    'database',
    'application',
  ]

  const isToolBased = jobSpecificPatterns.some(pattern =>
    skill.toLowerCase().includes(pattern)
  )

  return hasTrainingLanguage && isToolBased
}

export function estimateTimeToCompetency(skill: string): number {
  const skillLower = skill.toLowerCase()

  if (skillLower.includes('gate') || skillLower.includes('system')) return 2
  if (skillLower.includes('procedure') || skillLower.includes('protocol')) return 5
  if (skillLower.includes('software') || skillLower.includes('tool')) return 7

  return 10
}

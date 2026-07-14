export interface SkillMatch {
  name: string
  category: 'core_competency' | 'transferable' | 'job_specific' | 'baseline'
  matched: boolean
  trainable?: boolean
  timeToCompetency?: number
}

export interface SkillGapAnalysis {
  overall: number
  core_competencies: { matched: number; total: number; pct: number }
  transferable: { matched: number; total: number; pct: number }
  job_specific: { matched: number; total: number; pct: number }
  baseline: { matched: number; total: number; pct: number }
  ready_immediately: number
  trainable_gaps: number
  time_to_full_competency: number
  hiring_probability: number
  competitive_advantages: Array<{
    title: string
    description: string
    cvEvidence: string
    relevance: 'critical' | 'high' | 'medium'
  }>
}

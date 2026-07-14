export interface SkillCategory {
  category: 'core_competency' | 'transferable' | 'job_specific' | 'baseline'
  skills: Array<{
    name: string
    matched: boolean
    trainable: boolean
    timeToCompetency?: number
  }>
}

export interface ReadinessScore {
  overall: number
  core_competencies: { matched: number; total: number; pct: number }
  transferable: { matched: number; total: number; pct: number }
  job_specific: { matched: number; total: number; pct: number; trainable_count: number }
  baseline: { matched: number; total: number; pct: number }
  ready_immediately: number
  trainable_gaps: number
  time_to_full_competency: number
}

export interface HiringProbability {
  probability: number
  confidence: 'high' | 'medium' | 'low'
  reasoning: string[]
}

/**
 * `matchedByCategory` is expected to have at most one entry per category,
 * each holding ALL of that category's skills — not one entry per skill.
 * The job-specific trainable-gap count below looks up its category entry
 * with `.find()`, which only inspects the first match; a caller that
 * passes one entry per skill will silently undercount every job-specific
 * skill after the first.
 */
export function computeReadinessScore(
  matchedByCategory: SkillCategory[],
  timeToCompetencyOverride?: number
): ReadinessScore {
  const weights = {
    core_competency: 0.5,
    transferable: 0.3,
    job_specific: 0.15,
    baseline: 0.05,
  }

  let overallScore = 0
  const results: Record<string, { matched: number; total: number; pct: number }> = {
    core_competencies: { matched: 0, total: 0, pct: 0 },
    transferable: { matched: 0, total: 0, pct: 0 },
    job_specific: { matched: 0, total: 0, pct: 0 },
    baseline: { matched: 0, total: 0, pct: 0 },
  }

  matchedByCategory.forEach(cat => {
    const key = cat.category === 'core_competency' ? 'core_competencies' : cat.category
    results[key].total += cat.skills.length
    results[key].matched += cat.skills.filter(s => s.matched).length
  })

  // Only categories that actually have skills (total > 0) count toward the
  // overall score. Previously an empty category (e.g. no baseline skills
  // ever extracted — extractSkillsFromText's vocabulary doesn't produce any
  // baseline-tier bucket names) contributed 0% at full weight, permanently
  // dragging the score down for something that was never evaluated rather
  // than something the candidate lacks. Weights are renormalized over the
  // active (non-empty) categories so they still sum to 100%.
  const totalActiveWeight = Object.entries(weights).reduce((sum, [category, weight]) => {
    const key = category === 'core_competency' ? 'core_competencies' : category
    return results[key].total > 0 ? sum + weight : sum
  }, 0)

  Object.entries(weights).forEach(([category, weight]) => {
    const key = category === 'core_competency' ? 'core_competencies' : category
    const { matched, total } = results[key]
    const pct = total > 0 ? (matched / total) * 100 : 0
    results[key].pct = Math.round(pct)

    if (total > 0 && totalActiveWeight > 0) {
      overallScore += (pct / 100) * (weight / totalActiveWeight) * 100
    }
  })

  const jobSpecificTrainable = matchedByCategory.find(
    cat => cat.category === 'job_specific'
  )
  const trainableCount = jobSpecificTrainable?.skills.filter(s => s.trainable).length ?? 0
  const trainableGaps = Math.max(0, trainableCount - (results.job_specific.matched ?? 0))

  let maxTimeToCompetency = 0
  matchedByCategory.forEach(cat => {
    if (cat.category === 'job_specific') {
      cat.skills.forEach(skill => {
        if (skill.trainable && !skill.matched) {
          maxTimeToCompetency = Math.max(maxTimeToCompetency, skill.timeToCompetency ?? 10)
        }
      })
    }
  })

  return {
    overall: Math.round(overallScore),
    core_competencies: results.core_competencies,
    transferable: results.transferable,
    job_specific: { ...results.job_specific, trainable_count: trainableCount },
    baseline: results.baseline,
    ready_immediately: Math.round(overallScore),
    trainable_gaps: Math.round(Math.max(0, 100 - overallScore)),
    time_to_full_competency: Math.min(maxTimeToCompetency, 30),
  }
}

export function estimateHiringProbability(readiness: ReadinessScore): HiringProbability {
  const coreMatch = readiness.core_competencies.pct
  const trainableGapsCount = readiness.trainable_gaps

  const reasoning: string[] = []
  let probability = 0

  if (coreMatch >= 90) {
    probability += 40
    reasoning.push('Core competencies excellent (>90%)')
  } else if (coreMatch >= 75) {
    probability += 35
    reasoning.push('Core competencies strong (75–90%)')
  } else if (coreMatch >= 60) {
    probability += 25
    reasoning.push('Core competencies adequate (60–75%)')
  } else {
    probability += 10
    reasoning.push('Core competencies below threshold (<60%)')
  }

  if (trainableGapsCount <= 2) {
    probability += 35
    reasoning.push('Few trainable gaps (1–2)')
  } else if (trainableGapsCount <= 5) {
    probability += 25
    reasoning.push('Moderate trainable gaps (3–5)')
  } else {
    probability += 10
    reasoning.push('Many trainable gaps (>5)')
  }

  if (readiness.time_to_full_competency <= 7) {
    probability += 20
    reasoning.push('Fast ramp-up time (≤1 week)')
  } else if (readiness.time_to_full_competency <= 14) {
    probability += 15
    reasoning.push('Moderate ramp-up time (1–2 weeks)')
  } else {
    probability += 10
    reasoning.push('Longer ramp-up time (>2 weeks)')
  }

  if (readiness.overall >= 75) {
    probability += 10
    reasoning.push('Overall strong match (≥75%)')
  }

  let confidence: 'high' | 'medium' | 'low' = 'low'
  if (probability >= 75) {
    confidence = 'high'
  } else if (probability >= 50) {
    confidence = 'medium'
  }

  return {
    probability: Math.min(probability, 100),
    confidence,
    reasoning,
  }
}

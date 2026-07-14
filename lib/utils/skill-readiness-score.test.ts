import { computeReadinessScore, estimateHiringProbability } from '@/lib/utils/skill-readiness-score'

describe('Readiness Score', () => {
  it('computes weighted score correctly', () => {
    const mockCategories = [
      {
        category: 'core_competency' as const,
        skills: [
          { name: 'problem solving', matched: true, trainable: false },
          { name: 'communication', matched: true, trainable: false },
        ],
      },
      {
        category: 'job_specific' as const,
        skills: [
          { name: 'ticket gates', matched: false, trainable: true, timeToCompetency: 2 },
        ],
      },
    ]

    const score = computeReadinessScore(mockCategories)
    expect(score.overall).toBeGreaterThan(0)
    expect(score.overall).toBeLessThanOrEqual(100)
  })

  it('does not drop job-specific skills beyond the first when computing trainable gaps', () => {
    // Regression test: computeReadinessScore's trainable-gap lookup uses
    // `.find()` on the category list, so it only ever sees ONE entry per
    // category. All of a category's skills must live in a single entry's
    // `skills` array (grouped), never split across multiple entries with
    // the same `category` — the API route groups skills this way for
    // exactly this reason.
    const mockCategories = [
      {
        category: 'job_specific' as const,
        skills: [
          { name: 'gate system', matched: false, trainable: true, timeToCompetency: 2 },
          { name: 'ticketing software', matched: false, trainable: true, timeToCompetency: 7 },
          { name: 'crowd protocol', matched: false, trainable: true, timeToCompetency: 5 },
        ],
      },
    ]

    const score = computeReadinessScore(mockCategories)
    expect(score.job_specific.trainable_count).toBe(3)
    expect(score.time_to_full_competency).toBe(7)
  })

  it('does not let an empty category drag down the overall score', () => {
    // Regression test: extractSkillsFromText's vocabulary never produces a
    // baseline-tier bucket name, so `baseline` is routinely 0/0. Before this
    // fix, an empty category still counted at full weight with pct=0,
    // capping a perfect match at 95% (100 - baseline's 5% weight) even
    // though nothing in the baseline tier was ever actually evaluated.
    const mockCategories = [
      { category: 'core_competency' as const, skills: [{ name: 'a', matched: true, trainable: false }] },
      { category: 'transferable' as const, skills: [{ name: 'b', matched: true, trainable: false }] },
      { category: 'job_specific' as const, skills: [{ name: 'c', matched: true, trainable: false }] },
      // no 'baseline' entry at all — total must be excluded, not scored as 0%
    ]

    const score = computeReadinessScore(mockCategories)
    expect(score.baseline.total).toBe(0)
    expect(score.overall).toBe(100)
  })

  it('estimates hiring probability for strong candidates', () => {
    const strongReadiness = {
      overall: 85,
      core_competencies: { matched: 8, total: 8, pct: 100 },
      transferable: { matched: 5, total: 5, pct: 100 },
      job_specific: { matched: 1, total: 3, pct: 33, trainable_count: 2 },
      baseline: { matched: 4, total: 4, pct: 100 },
      ready_immediately: 85,
      trainable_gaps: 15,
      time_to_full_competency: 10,
    }

    const prob = estimateHiringProbability(strongReadiness)
    expect(prob.probability).toBeGreaterThan(70)
    expect(prob.confidence).toBe('high')
  })
})

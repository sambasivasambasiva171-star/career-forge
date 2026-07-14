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

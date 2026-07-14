import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { getCompletion } from '@/lib/ai/client'
import { analyzeGapSchema } from '@/lib/validation/schemas'
import {
  computeReadinessScore,
  estimateHiringProbability,
  type SkillCategory,
  type ReadinessScore,
  type HiringProbability,
} from '@/lib/utils/skill-readiness-score'
import { detectCompetitiveAdvantages, type CompetitiveAdvantage } from '@/lib/utils/competitive-advantages'
import { categorizeSkill, isTrainable, estimateTimeToCompetency } from '@/lib/utils/skill-categories'

/**
 * POST /api/skill-gap/strategic
 *
 * Categorizes JD skills by how trainable they are (core competency /
 * transferable / job-specific / baseline) using rule-based heuristics,
 * computes a weighted readiness score and a hiring-probability estimate,
 * surfaces competitive advantages found in the resume text, and asks the
 * AI for a short confidence-building narrative summarizing all of the
 * above. The narrative call degrades gracefully — if it fails, a canned
 * narrative built from the same numbers is returned instead of failing
 * the request, since the numeric analysis is this endpoint's core value
 * and shouldn't be blocked by a supplementary AI-written paragraph.
 *
 * @body { resume_id: string, jd_id: string }
 * @returns 200 { success: true, readiness, hiring_probability, competitive_advantages, strategic_narrative }
 * @error 400 INVALID_INPUT
 * @error 401 UNAUTHORIZED
 * @error 404 NOT_FOUND — resume or job description doesn't exist or isn't owned by the caller
 * @error 500 INTERNAL_ERROR
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body', code: 'INVALID_INPUT' }, { status: 400 })
    }

    const parsed = analyzeGapSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 })
    }
    const { resume_id, jd_id } = parsed.data

    const [resumeResult, jdResult] = await Promise.all([
      supabase.from('resumes').select('*').eq('id', resume_id).eq('user_id', user.id).single(),
      supabase.from('job_descriptions').select('*').eq('id', jd_id).eq('user_id', user.id).single(),
    ])

    if (!resumeResult.data || !jdResult.data) {
      return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 })
    }

    const cvText = JSON.stringify(resumeResult.data.parsed_json || {})
    const jdText = jdResult.data.raw_text || ''

    const jdSkills = extractSkillsFromText(jdText)
    const cvSkills = extractSkillsFromText(cvText)

    // Group by category — computeReadinessScore's trainable-gap count looks
    // up its job_specific entry with `.find()`, which only ever inspects the
    // FIRST match. Passing one entry per skill (rather than one entry per
    // category containing all its skills) would silently drop every
    // job-specific skill after the first from that calculation.
    const byCategory = new Map<SkillCategory['category'], SkillCategory['skills']>()
    for (const jdSkill of jdSkills) {
      const category = categorizeSkill(jdSkill, jdText)
      const matched = cvSkills.some(cvSkill => similarityScore(jdSkill, cvSkill) > 0.7)
      const trainable = isTrainable(jdSkill, jdText)

      const skill = {
        name: jdSkill,
        matched,
        trainable,
        timeToCompetency: trainable ? estimateTimeToCompetency(jdSkill) : undefined,
      }

      const existing = byCategory.get(category)
      if (existing) {
        existing.push(skill)
      } else {
        byCategory.set(category, [skill])
      }
    }
    const matchedByCategory: SkillCategory[] = Array.from(byCategory.entries()).map(
      ([category, skills]) => ({ category, skills })
    )

    const readiness = computeReadinessScore(matchedByCategory)
    const hiringProbability = estimateHiringProbability(readiness)
    const advantages = detectCompetitiveAdvantages(cvText, jdText)
    const narrative = await generateStrategicNarrative(readiness, hiringProbability, advantages)

    return NextResponse.json({
      success: true,
      readiness,
      hiring_probability: hiringProbability,
      competitive_advantages: advantages,
      strategic_narrative: narrative,
    })
  } catch (error) {
    console.error('[SKILL_GAP_STRATEGIC]', error)
    return NextResponse.json({ error: 'Failed to run strategic skill gap analysis.', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

/**
 * Ask the AI for a short narrative reframing the numeric analysis above
 * in encouraging-but-honest terms. Uses this app's NVIDIA NIM client
 * (lib/ai/client.ts) — not a second AI provider — so it shares the same
 * API key, logging, and cost tracking as every other AI feature here.
 */
async function generateStrategicNarrative(
  readiness: ReadinessScore,
  hiringProbability: HiringProbability,
  advantages: CompetitiveAdvantage[]
): Promise<string> {
  const fallback =
    `You are a strong candidate. Your core competencies match well (${readiness.core_competencies.pct}%). ` +
    `Job-specific skills are trainable (typically ${readiness.time_to_full_competency} days on the job). ` +
    `Estimated hiring probability: ${hiringProbability.probability}%. Apply with confidence.`

  const systemPrompt =
    'You are a career coach who writes strategic, confidence-building feedback for job seekers. ' +
    'Separate trainable skills from core competencies. Reframe skill gaps as learnable rather than ' +
    'disqualifying. State the hiring probability and the reasoning behind it. Use encouraging but ' +
    'honest language — never promise an outcome, only describe realistic likelihood. Respond with ' +
    'the narrative text only, no preamble and no markdown headers.'

  const userPrompt = `Write a brief, confidence-building narrative (200 words max) from this analysis:
- Overall readiness: ${readiness.overall}%
- Core competencies match: ${readiness.core_competencies.pct}%
- Trainable gaps: ${readiness.trainable_gaps}%
- Estimated hiring probability: ${hiringProbability.probability}% (${hiringProbability.confidence} confidence)
- Typical time to full competency: ${readiness.time_to_full_competency} days
- Competitive advantages: ${advantages.map(a => a.title).join(', ') || 'none identified'}

The narrative should:
1. Open by reframing the overall percentage — it undersells the candidate because it treats trainable, employer-provided skills the same as core competencies
2. Highlight the core-competency match as the rare, hard-to-train part
3. Reframe the trainable gaps as standard onboarding, not a disqualifier
4. State the hiring probability plainly
5. End with a short, confident closing line

Keep it under 200 words.`

  try {
    const narrative = await getCompletion({
      systemPrompt,
      userPrompt,
      temperature: 0.4,
      maxTokens: 400,
    })
    return narrative.trim() || fallback
  } catch (err) {
    console.error('[SKILL_GAP_NARRATIVE]', err)
    return fallback
  }
}

function similarityScore(skill1: string, skill2: string): number {
  const s1 = skill1.toLowerCase().trim()
  const s2 = skill2.toLowerCase().trim()
  if (s1 === s2) return 1.0
  if (s1.includes(s2) || s2.includes(s1)) return 0.8
  const words1 = new Set(s1.split(/\s+/))
  const words2 = new Set(s2.split(/\s+/))
  const intersection = new Set([...words1].filter(w => words2.has(w)))
  const union = new Set([...words1, ...words2])
  return intersection.size / union.size
}

function extractSkillsFromText(text: string): string[] {
  const skillKeywords = [
    'communication',
    'problem solving',
    'teamwork',
    'customer service',
    'leadership',
    'time management',
    'adaptability',
    'working under pressure',
    'conflict resolution',
    'crisis management',
    'reliability',
    'professionalism',
    'staff mobilization',
    'training',
    'learning',
  ]
  return skillKeywords.filter(skill => text.toLowerCase().includes(skill))
}

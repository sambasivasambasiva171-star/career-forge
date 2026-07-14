import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { analyzeGapSchema } from '@/lib/validation/schemas'
import {
  computeReadinessScore,
  estimateHiringProbability,
  type SkillCategory,
} from '@/lib/utils/skill-readiness-score'
import { detectCompetitiveAdvantages } from '@/lib/utils/competitive-advantages'
import { categorizeSkill, isTrainable, estimateTimeToCompetency } from '@/lib/utils/skill-categories'

/**
 * POST /api/skill-gap/strategic
 *
 * Rule-based (non-AI) companion to /api/jd/analyze: categorizes JD skills
 * by how trainable they are (core competency / transferable / job-specific
 * / baseline), computes a weighted readiness score and a hiring-probability
 * estimate, and surfaces competitive advantages found in the resume text.
 *
 * @body { resume_id: string, jd_id: string }
 * @returns 200 { success: true, readiness, hiring_probability, competitive_advantages }
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

    return NextResponse.json({
      success: true,
      readiness,
      hiring_probability: hiringProbability,
      competitive_advantages: advantages,
    })
  } catch (error) {
    console.error('[SKILL_GAP_STRATEGIC]', error)
    return NextResponse.json({ error: 'Failed to run strategic skill gap analysis.', code: 'INTERNAL_ERROR' }, { status: 500 })
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

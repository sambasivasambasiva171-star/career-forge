import { z } from 'zod'

export const parseResumeSchema = z.object({
  resume_id: z.string().uuid(),
})

export const analyzeGapSchema = z.object({
  resume_id: z.string().uuid(),
  jd_id: z.string().uuid(),
})

export const generateQuestionnaireSchema = z.object({
  resume_id: z.string().uuid(),
  jd_id: z.string().uuid(),
})

export const extractSkillSchema = z.object({
  jd_id: z.string().uuid(),
  question: z.string().min(1).max(2000),
  answer: z.string().min(1).max(5000),
})

export const validateSkillsSchema = z.object({
  resume_id: z.string().uuid(),
  approved: z.array(z.object({
    question_id: z.string(),
    target_skill: z.string(),
    question: z.string(),
    skill_identified: z.string(),
    resume_bullet: z.string(),
  })),
})

export const generateResumeSchema = z.object({
  resume_id: z.string().uuid(),
  jd_id: z.string().uuid(),
})

export const generateNetworkingSchema = z.object({
  jd_id: z.string().uuid(),
})

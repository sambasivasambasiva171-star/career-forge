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

export const extractSkillRewriteSchema = z.object({
  jd_id: z.string().uuid(),
  existing_bullet: z.string().max(2000).optional().default(''),
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
    work_experience_index: z.number().optional(),
    responsibility_index: z.number().optional(),
  })),
})

export const generateResumeSchema = z.object({
  resume_id: z.string().uuid(),
  jd_id: z.string().uuid(),
})

export const generateNetworkingSchema = z.object({
  jd_id: z.string().uuid(),
})

export const preFlightCheckSchema = z.object({
  jd_id: z.string().uuid(),
})

export const generateResumeWithFactsSchema = z.object({
  resume_id: z.string().uuid(),
  jd_id: z.string().uuid(),
  preflight_facts: z.array(z.string()).optional().default([]),
})

export const renderResumePdfSchema = z.object({
  resume_data: z.record(z.string(), z.unknown()),
})

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
  cv_document_id: z.string().uuid(),
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
  questionnaire_skipped: z.boolean().optional().default(false),
  regenerate: z.boolean().optional().default(false),
})

export const renderResumePdfSchema = z.object({
  resume_data: z.object({
    document_title: z.string().optional(),
    contact: z.object({
      name: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      location: z.string().nullable().optional(),
      linkedin: z.string().nullable().optional(),
    }).default({ name: null, email: null, phone: null, location: null, linkedin: null }),

    summary: z.string().nullable().optional(),

    skills: z.array(z.string()).default([]),

    work_experience: z.array(z.object({
      title: z.string().default(''),
      company: z.string().default(''),
      start_date: z.string().nullable().optional(),
      end_date: z.string().nullable().optional(),
      location: z.string().nullable().optional(),
      responsibilities: z.array(z.string()).default([]),
    })).default([]),

    education: z.array(z.object({
      degree: z.string().default(''),
      institution: z.string().default(''),
      start_date: z.string().nullable().optional(),
      end_date: z.string().nullable().optional(),
    })).default([]),

    projects: z.array(z.object({
      name: z.string().default(''),
      description: z.string().default(''),
      technologies: z.array(z.string()).default([]),
    })).default([]),

    certifications: z.array(z.string()).default([]),

    pre_screening_details: z.array(z.string()).default([]),
  }),
})

export const updateProfileSchema = z.object({
  persona_type: z.enum(['fresher', 'experienced']).optional(),
  location: z.string().max(200).optional(),
})

export const updateProfileStep1Schema = z.object({
  persona_type: z.enum(['fresher', 'experienced']),
  job_market: z.enum(['IN', 'GB', 'GLOBAL']),
  preflight_responses: z.record(z.string(), z.boolean()),
})

export const targetRoleSchema = z.object({
  target_role: z.string().max(200).optional(),
})

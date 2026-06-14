import { z } from 'zod'

export const parseResumeSchema = z.object({
  resume_id: z.string().uuid(),
})

export const analyzeGapSchema = z.object({
  resume_id: z.string().uuid(),
  jd_id: z.string().uuid(),
})

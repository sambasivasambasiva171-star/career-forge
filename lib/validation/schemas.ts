import { z } from 'zod'

export const parseResumeSchema = z.object({
  resume_id: z.string().uuid(),
})

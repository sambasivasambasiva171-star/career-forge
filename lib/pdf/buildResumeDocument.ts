import { ResumeDocument } from './ResumeDocument'

export interface EditableResumeData {
  contact: { name: string | null; email: string | null; phone: string | null; location: string | null; linkedin: string | null }
  summary: string | null
  work_experience: Array<{ title: string; company: string; start_date: string | null; end_date: string | null; location: string | null; responsibilities: string[] }>
  education: Array<{ degree: string; institution: string; start_date: string | null; end_date: string | null }>
  skills: string[]
  projects: Array<{ name: string; description: string; technologies: string[] }>
  certifications: string[]
  pre_screening_details: string[]
  document_title?: string
}

export { ResumeDocument }

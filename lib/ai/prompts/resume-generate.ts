export const RESUME_GENERATE_SYSTEM_PROMPT = `You are a resume optimization engine. You will receive: (1) a candidate's structured resume data, (2) a list of validated skill additions the candidate approved, (3) the target job description, (4) the candidate's persona type (fresher or experienced), and (5) a language variant ("uk_english" or "us_english").

Your job is to produce a FINAL, ATS-optimized resume structure that merges the validated additions naturally into the existing content and reorders/prioritizes sections per these rules:

- If persona is "experienced": include only the most recent 2-3 roles from work_experience (drop older roles unless fewer than 3 exist).
- If persona is "fresher": keep all work_experience entries.

For EVERY item in validated_additions:
- Add its "skill_identified" value to the skills array (avoid duplicates, normalize casing).
- If the item has "work_experience_index" and "responsibility_index" fields (both numbers, not undefined): REPLACE the responsibility at that exact position in that work_experience entry's responsibilities array with the item's "resume_bullet" text (this is a rewrite of an existing bullet, not a new addition).
- If the item does NOT have work_experience_index/responsibility_index (undefined/missing): add its "resume_bullet" as a NEW bullet point appended to the responsibilities array of the most contextually relevant work_experience entry, or the most recent role if none fits.

SKILLS RULES — follow exactly:

1. MAXIMUM 12 skills total. If more than 12 qualify, keep only the 12 most relevant to the job description keywords.

2. REMOVE all generic soft skills. These add no ATS value and must never appear in the output:
   - Fast Learner, Quick Learner
   - Team Player, Teamwork, Teamwork & Collaboration
   - Hard Working, Dedicated, Motivated
   - Adaptability, Flexibility
   - Reliability, Punctuality, Reliability & Punctuality
   - Professional Conduct, Work Ethic
   - Communication Skills (too vague — only include if the JD specifically lists a communication tool or method e.g. "written communication for regulatory reports")
   - Attention to Detail (only include if the JD uses this exact phrase as a stated requirement)

3. DEDUPLICATE synonyms. When two or more skills mean the same thing, keep only the one that most closely matches the JD wording. Examples:
   - "Guest Service Recovery" + "Customer Complaint Resolution" -> keep whichever phrase appears in the JD, drop the other
   - "Conflict Management" + "Problem Solving" -> keep one
   - "Organisation Skills" + "Time Management" -> keep one
   - "Customer Service" + "Customer-Facing Operations" -> keep one

4. PREFER hard skills and JD-exact keyword matches over generic descriptors. A skill that appears verbatim in the JD is worth 3 generic skills for ATS scoring purposes.

5. FORMAT: Each skill as a concise noun phrase, maximum 4 words. Do not truncate. If a natural skill name exceeds 4 words, shorten it to its most recognisable form.
   - "Customer Service" (correct)
   - "Crisis Management" (correct)
   - "Operational Procedures" (correct)
   - "Customer-Facing Operations Management and Support" (incorrect — too long)
   - "Working Under Pressure in Fast-Paced Environments" (incorrect — too long)

CRITICAL RULES ON PROJECTS:
- Only include a "projects" array if the ORIGINAL resume data already contained real projects (e.g. software projects, academic projects, portfolio work).
- NEVER create new project entries from validated_additions. Validated additions are work experience enhancements and skills only — never projects.
- If the original resume has no projects section, return "projects": [] in the output.
- Never invent a "technologies" list for non-technical work.

LANGUAGE VARIANT RULES:
- If language_variant is "uk_english": use British spelling throughout (e.g. "optimised" not "optimized", "organisation" not "organization", "specialised" not "specialized", "programme" not "program", "centre" not "center", "colour" not "color", "analyse" not "analyze"). Apply this to every field including summary, responsibilities, skills, and project descriptions. This applies to ALL text in your output, including rewritten versions of existing resume bullets — convert any US spellings found in the original to UK equivalents.
- If language_variant is "us_english": use American spelling throughout (e.g. "optimized", "organization", "specialized", "program", "center", "color", "analyze").

ADDITIONAL CONFIRMED FACTS:
- The "certifications" array in your output may ONLY contain genuine credentials present in the ORIGINAL resume data's certifications array (e.g. courses, certificates, professional qualifications). NEVER put visa/relocation/right-to-work/driving-licence declarations here.
- The "pre_screening_details" array in your output holds short entries derived from "ADDITIONAL CONFIRMED FACTS ABOUT THE CANDIDATE" below, using this mapping:
  - "Candidate holds a valid driving license." -> "Full Driving License"
  - "Candidate has confirmed right to work in the target country." -> "Eligible to Work in [Country, inferred from JD/location context]"
  - "Candidate is willing to relocate for this role." -> "Open to Relocation"
  - "Candidate is eligible for or interested in visa sponsorship for this role." -> "Open to Visa Sponsorship"
- If "ADDITIONAL CONFIRMED FACTS ABOUT THE CANDIDATE" is "None", return "pre_screening_details": [].
- NEVER invent, assume, or infer any certification, license, status, or qualification not explicitly present in the original data or confirmed facts.

OTHER RULES:
- Remove any personal details unrelated to employability (hobbies like "watching TV", marital status, etc.) if present.
- Do not fabricate companies, dates, or roles. Only reorganize, merge, and integrate what is provided.

Return ONLY valid JSON — no markdown, no code fences, no explanation.

Output this exact structure (same shape as input resume data):
{
  "contact": { "name": string|null, "email": string|null, "phone": string|null, "location": string|null, "linkedin": string|null },
  "summary": string|null,
  "work_experience": [ { "title": string, "company": string, "start_date": string|null, "end_date": string|null, "location": string|null, "responsibilities": [string] } ],
  "education": [ { "degree": string, "institution": string, "start_date": string|null, "end_date": string|null } ],
  "skills": [string],
  "projects": [ { "name": string, "description": string, "technologies": [string] } ],
  "certifications": [string],
  "pre_screening_details": [string]
}

Return ONLY the JSON object.`

export function buildResumeGenerateUserPrompt(
  resumeJson: object,
  validatedAdditions: unknown[],
  jdText: string,
  persona: string,
  languageVariant: string,
  preflightFacts: string[]
): string {
  return `PERSONA: ${persona}\n\nLANGUAGE_VARIANT: ${languageVariant}\n\nCURRENT RESUME DATA (JSON):\n${JSON.stringify(resumeJson, null, 2)}\n\nVALIDATED ADDITIONS (approved by candidate):\n${JSON.stringify(validatedAdditions, null, 2)}\n\nADDITIONAL CONFIRMED FACTS ABOUT THE CANDIDATE (map these into "pre_screening_details" per the mapping rules):\n${preflightFacts.length > 0 ? preflightFacts.join('\n') : 'None'}\n\nTARGET JOB DESCRIPTION:\n${jdText}`
}

export const COVER_LETTER_SYSTEM_PROMPT = `You are a cover letter writing engine. You will receive a candidate's final resume data (JSON), a target job description, and a language variant ("uk_english" or "us_english"). Write a professional cover letter (3-4 short paragraphs) that:

- Focuses on how the candidate's skills and experience directly address the business needs in the job description.
- Does NOT use generic phrases like "I am writing to express my interest" or focus on the candidate's career ambitions.
- References 2-3 specific, concrete items from the candidate's resume (roles, skills, achievements) and connects them to specific requirements in the JD.
- Uses a professional, confident tone without being arrogant.
- Does not invent any information not present in the resume.
- Uses British spelling if language_variant is "uk_english" (e.g. "organisation", "specialised"), or American spelling if "us_english".

Return ONLY valid JSON — no markdown, no code fences, no explanation.

Output structure:
{
  "cover_letter_text": string
}

The cover_letter_text should be plain text with paragraphs separated by double newlines (\\n\\n), ready to be placed directly into a document. Do not include a date, address blocks, or salutation placeholders like "[Hiring Manager Name]" — start directly with "Dear Hiring Manager," and end with "Sincerely," followed by the candidate's name from the resume.

Return ONLY the JSON object.`

export function buildCoverLetterUserPrompt(resumeJson: object, jdText: string, languageVariant: string): string {
  return `LANGUAGE_VARIANT: ${languageVariant}\n\nFINAL RESUME DATA (JSON):\n${JSON.stringify(resumeJson, null, 2)}\n\nTARGET JOB DESCRIPTION:\n${jdText}`
}

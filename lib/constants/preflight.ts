export const PREFLIGHT_CHECKLIST = [
  {
    key: 'right_to_work',
    label: 'I have the right to work in my target country',
    description: 'Indicate you can work without sponsorship in your target market.',
  },
  {
    key: 'requires_visa_sponsorship',
    label: 'I require visa sponsorship',
    description: "Many employers state upfront if they cannot offer this — let's set expectations right.",
  },
  {
    key: 'holds_driving_license',
    label: 'I hold a driving licence',
    description: 'Relevant for many hotel, retail, and field roles, if you specify yours.',
  },
  {
    key: 'willing_to_relocate',
    label: 'I am willing to relocate',
    description: 'Indicate whether you can relocate for the right opportunity.',
  },
] as const

export type PreflightKey = typeof PREFLIGHT_CHECKLIST[number]['key']

export const JOB_MARKETS = [
  { code: 'IN', label: 'India' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'GLOBAL', label: 'Global / Other' },
] as const

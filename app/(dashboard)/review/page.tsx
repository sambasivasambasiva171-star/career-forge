'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import StepProgress from '@/components/StepProgress'
import { createClient } from '@/lib/supabase/client'
import { PREFLIGHT_CHECKLIST } from '@/lib/constants/preflight'

interface EditableResume {
  contact: {
    name: string | null
    email: string | null
    phone: string | null
    location: string | null
    linkedin: string | null
  }
  summary: string | null
  work_experience: Array<{
    title: string
    company: string
    start_date: string | null
    end_date: string | null
    location: string | null
    responsibilities: string[]
  }>
  education: Array<{
    degree: string
    institution: string
    start_date: string | null
    end_date: string | null
  }>
  skills: string[]
  projects: Array<{
    name: string
    description: string
    technologies: string[]
  }>
  certifications: string[]
  document_title?: string
  language_variant?: string
}

interface ParsedResume {
  contact: {
    name: string | null
    email: string | null
    phone: string | null
    location: string | null
    linkedin: string | null
  }
  summary: string | null
  work_experience: Array<{
    title: string
    company: string
    start_date: string | null
    end_date: string | null
    location: string | null
    responsibilities: string[]
  }>
  education: Array<{
    degree: string
    institution: string
    start_date: string | null
    end_date: string | null
  }>
  skills: string[]
  projects: Array<{
    name: string
    description: string
    technologies: string[]
  }>
  certifications: string[]
}

function ReviewPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resumeId = searchParams.get('resume_id')
  const jdId = searchParams.get('jd_id')

  const [preflightResponses, setPreflightResponses] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (resumeId && jdId) {
      handleAnalyzeGap()
    }
  }, [resumeId, jdId])

  useEffect(() => {
    async function loadPreflightResponses() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('preflight_responses')
        .eq('id', user.id)
        .single()

      if (profile?.preflight_responses) {
        setPreflightResponses(profile.preflight_responses as Record<string, boolean>)
      }
    }
    loadPreflightResponses()
  }, [])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedResume | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [gapAnalysis, setGapAnalysis] = useState<{
    matched_skills: Array<{ skill: string; evidence: string }>
    missing_skills: Array<{ skill: string; jd_context: string }>
    partial_skills: Array<{ skill: string; resume_evidence: string; jd_requirement: string }>
  } | null>(null)
  const [generatingQuestions, setGeneratingQuestions] = useState(false)
  const [questions, setQuestions] = useState<Array<{ id: string; target_skill: string; question_text: string; work_experience_index?: number; responsibility_index?: number; existing_bullet?: string }>>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submittingAnswer, setSubmittingAnswer] = useState<string | null>(null)
  const [extractedResults, setExtractedResults] = useState<Record<string, { skill_identified: string; rewritten_bullet: string }>>({})
  const [approvalChoices, setApprovalChoices] = useState<Record<string, boolean>>({})
  const [savingValidation, setSavingValidation] = useState(false)
  const [validationSaved, setValidationSaved] = useState(false)
  const [generatingResume, setGeneratingResume] = useState(false)
  const [finalResume, setFinalResume] = useState<EditableResume | null>(null)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [generatingCoverLetter, setGeneratingCoverLetter] = useState(false)
  const [coverLetter, setCoverLetter] = useState<string | null>(null)
  const [generatingNetworking, setGeneratingNetworking] = useState(false)
  const [networkingSuggestions, setNetworkingSuggestions] = useState<Array<{ category: string; suggestion_text: string }>>([])
  const [currentStep, setCurrentStep] = useState(0)

  async function handleGenerateQuestions() {
    if (!resumeId || !jdId) {
      setError('Missing resume or job description ID.')
      return
    }

    setGeneratingQuestions(true)
    setError(null)

    try {
      const res = await fetch('/api/questionnaire/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume_id: resumeId, jd_id: jdId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        return
      }

      setQuestions(data.questions)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setGeneratingQuestions(false)
    }
  }

  async function handleSubmitAnswer(questionId: string, questionText: string, existingBullet: string) {
    const answer = answers[questionId]
    if (!answer || !answer.trim()) {
      setError('Please enter an answer before submitting.')
      return
    }

    if (!jdId) {
      setError('Missing job description ID.')
      return
    }

    setSubmittingAnswer(questionId)
    setError(null)

    try {
      const res = await fetch('/api/questionnaire/extract-skill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd_id: jdId, existing_bullet: existingBullet, question: questionText, answer: answer.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        return
      }

      setExtractedResults((prev) => ({
        ...prev,
        [questionId]: { skill_identified: data.skill_identified, rewritten_bullet: data.rewritten_bullet },
      }))
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmittingAnswer(null)
    }
  }

  async function handleSaveValidation() {
    if (!resumeId) {
      setError('Missing resume ID.')
      return
    }

    const approved = questions
      .filter((q) => extractedResults[q.id] && approvalChoices[q.id])
      .map((q) => ({
        question_id: q.id,
        target_skill: q.target_skill,
        question: q.question_text,
        skill_identified: extractedResults[q.id].skill_identified,
        resume_bullet: extractedResults[q.id].rewritten_bullet,
        work_experience_index: q.work_experience_index,
        responsibility_index: q.responsibility_index,
      }))

    setSavingValidation(true)
    setError(null)

    try {
      const res = await fetch('/api/skills/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume_id: resumeId, approved }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        return
      }

      setValidationSaved(true)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSavingValidation(false)
    }
  }

  async function handleGenerateResume() {
    if (!resumeId || !jdId) {
      setError('Missing resume or job description ID.')
      return
    }

    setGeneratingResume(true)
    setError(null)

    const preflightFacts: string[] = []
      PREFLIGHT_CHECKLIST.forEach((item) => {
        if (preflightResponses[item.key]) {
          if (item.key === 'right_to_work') {
            preflightFacts.push('Candidate has confirmed right to work in the target country.')
          } else if (item.key === 'requires_visa_sponsorship') {
            preflightFacts.push('Candidate is eligible for or interested in visa sponsorship for this role.')
          } else if (item.key === 'holds_driving_license') {
            preflightFacts.push('Candidate holds a valid driving license.')
          } else if (item.key === 'willing_to_relocate') {
            preflightFacts.push('Candidate is willing to relocate for this role.')
          }
        }
      })

    try {
      const res = await fetch('/api/resume/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume_id: resumeId, jd_id: jdId, preflight_facts: preflightFacts }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        return
      }

      setFinalResume(data.resume as EditableResume)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setGeneratingResume(false)
    }
  }

  async function handleGenerateCoverLetter() {
    if (!resumeId || !jdId) {
      setError('Missing resume or job description ID.')
      return
    }

    setGeneratingCoverLetter(true)
    setError(null)

    try {
      const res = await fetch('/api/cover-letter/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume_id: resumeId, jd_id: jdId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        return
      }

      setCoverLetter(data.cover_letter_text)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setGeneratingCoverLetter(false)
    }
  }

  async function handleGenerateNetworking() {
    if (!jdId) {
      setError('Missing job description ID.')
      return
    }

    setGeneratingNetworking(true)
    setError(null)

    try {
      const res = await fetch('/api/networking/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd_id: jdId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        return
      }

      setNetworkingSuggestions(data.suggestions)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setGeneratingNetworking(false)
    }
  }

  async function handleDownloadPdf() {
    if (!finalResume) return
    setDownloadingPdf(true)
    try {
      const res = await fetch('/api/resume/pdf-from-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume_data: finalResume }),
      })
      if (!res.ok) {
        setError('Failed to generate PDF.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const cd = res.headers.get('Content-Disposition') || ''
      const match = cd.match(/filename="([^"]+)"/)
      a.download = match ? match[1] : 'resume.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Network error generating PDF.')
    } finally {
      setDownloadingPdf(false)
    }
  }

  function updateContactField(field: keyof EditableResume['contact'], value: string) {
    setFinalResume((prev) => prev ? { ...prev, contact: { ...prev.contact, [field]: value } } : prev)
  }

  function updateSummary(value: string) {
    setFinalResume((prev) => prev ? { ...prev, summary: value } : prev)
  }

  function updateWorkResponsibility(expIndex: number, respIndex: number, value: string) {
    setFinalResume((prev) => {
      if (!prev) return prev
      const work = prev.work_experience.map((exp, i) => {
        if (i !== expIndex) return exp
        const responsibilities = exp.responsibilities.map((r, j) => j === respIndex ? value : r)
        return { ...exp, responsibilities }
      })
      return { ...prev, work_experience: work }
    })
  }

  function removeWorkResponsibility(expIndex: number, respIndex: number) {
    setFinalResume((prev) => {
      if (!prev) return prev
      const work = prev.work_experience.map((exp, i) => {
        if (i !== expIndex) return exp
        return { ...exp, responsibilities: exp.responsibilities.filter((_, j) => j !== respIndex) }
      })
      return { ...prev, work_experience: work }
    })
  }

  function addWorkResponsibility(expIndex: number) {
    setFinalResume((prev) => {
      if (!prev) return prev
      const work = prev.work_experience.map((exp, i) => {
        if (i !== expIndex) return exp
        return { ...exp, responsibilities: [...exp.responsibilities, ''] }
      })
      return { ...prev, work_experience: work }
    })
  }

  function updateWorkField(expIndex: number, field: 'title' | 'company' | 'location' | 'start_date' | 'end_date', value: string) {
    setFinalResume((prev) => {
      if (!prev) return prev
      const work = prev.work_experience.map((exp, i) =>
        i === expIndex ? { ...exp, [field]: value } : exp
      )
      return { ...prev, work_experience: work }
    })
  }

  function updateSkill(index: number, value: string) {
    setFinalResume((prev) => {
      if (!prev) return prev
      const skills = prev.skills.map((s, i) => i === index ? value : s)
      return { ...prev, skills }
    })
  }

  function removeSkill(index: number) {
    setFinalResume((prev) => prev ? { ...prev, skills: prev.skills.filter((_, i) => i !== index) } : prev)
  }

  function addSkill() {
    setFinalResume((prev) => prev ? { ...prev, skills: [...prev.skills, ''] } : prev)
  }

  function updateCertification(index: number, value: string) {
    setFinalResume((prev) => {
      if (!prev) return prev
      const certifications = prev.certifications.map((c, i) => i === index ? value : c)
      return { ...prev, certifications }
    })
  }

  function removeCertification(index: number) {
    setFinalResume((prev) => prev ? { ...prev, certifications: prev.certifications.filter((_, i) => i !== index) } : prev)
  }

  function addCertification() {
    setFinalResume((prev) => prev ? { ...prev, certifications: [...prev.certifications, ''] } : prev)
  }

  async function handleAnalyzeGap() {
    if (!resumeId || !jdId) {
      setError('Missing resume or job description ID.')
      return
    }

    setAnalyzing(true)
    setError(null)

    try {
      const res = await fetch('/api/jd/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume_id: resumeId, jd_id: jdId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        return
      }

      setGapAnalysis(data.analysis)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleParse() {
    if (!resumeId) {
      setError('Missing resume ID.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/resume/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume_id: resumeId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        return
      }

      setParsed(data.parsed_json)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto mt-12 space-y-6 pb-12">
      <StepProgress current={3} />
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {currentStep === 0 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Skill Gap Analysis</h2>
            <p className="text-sm text-gray-500 mt-1">
              Analysing your CV against the job description...
            </p>
          </div>

          {analyzing && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Analysing skill gaps...</p>
            </div>
          )}

          {gapAnalysis && !analyzing && (() => {
            const matched = gapAnalysis.matched_skills.length
            const partial = gapAnalysis.partial_skills.length
            const missing = gapAnalysis.missing_skills.length
            const total = matched + partial + missing || 1
            const matchedPct = Math.round((matched / total) * 100)
            const partialPct = Math.round((partial / total) * 100)
            const missingPct = Math.round((missing / total) * 100)

            const radius = 54
            const circumference = 2 * Math.PI * radius
            const matchedDash = (matchedPct / 100) * circumference
            const partialDash = (partialPct / 100) * circumference
            const missingDash = (missingPct / 100) * circumference
            const matchedOffset = 0
            const partialOffset = -matchedDash
            const missingOffset = -(matchedDash + partialDash)

            return (
              <div className="space-y-6">
                {/* Donut chart + legend */}
                <div className="bg-white border rounded-lg shadow-sm p-6 flex flex-col sm:flex-row items-center gap-6">
                  <div className="relative shrink-0">
                    <svg width="140" height="140" viewBox="0 0 140 140">
                      <circle cx="70" cy="70" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="16" />
                      {matched > 0 && (
                        <circle cx="70" cy="70" r={radius} fill="none" stroke="#22c55e" strokeWidth="16"
                          strokeDasharray={`${matchedDash} ${circumference - matchedDash}`}
                          strokeDashoffset={matchedOffset}
                          transform="rotate(-90 70 70)" />
                      )}
                      {partial > 0 && (
                        <circle cx="70" cy="70" r={radius} fill="none" stroke="#f59e0b" strokeWidth="16"
                          strokeDasharray={`${partialDash} ${circumference - partialDash}`}
                          strokeDashoffset={partialOffset}
                          transform="rotate(-90 70 70)" />
                      )}
                      {missing > 0 && (
                        <circle cx="70" cy="70" r={radius} fill="none" stroke="#ef4444" strokeWidth="16"
                          strokeDasharray={`${missingDash} ${circumference - missingDash}`}
                          strokeDashoffset={missingOffset}
                          transform="rotate(-90 70 70)" />
                      )}
                      <text x="70" y="65" textAnchor="middle" className="text-2xl font-bold" fill="#111827" fontSize="22" fontWeight="bold">{matchedPct}%</text>
                      <text x="70" y="82" textAnchor="middle" fill="#6b7280" fontSize="11">match</text>
                    </svg>
                  </div>

                  <div className="flex flex-col gap-3 w-full">
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" />Matched</span>
                        <span className="font-medium text-green-600">{matched} skills ({matchedPct}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${matchedPct}%` }} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />Partial</span>
                        <span className="font-medium text-amber-600">{partial} skills ({partialPct}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-amber-400 h-2 rounded-full transition-all" style={{ width: `${partialPct}%` }} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" />Missing</span>
                        <span className="font-medium text-red-600">{missing} skills ({missingPct}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-red-500 h-2 rounded-full transition-all" style={{ width: `${missingPct}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Skill detail cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-green-800 mb-2">✓ Matched Skills</h3>
                    <ul className="space-y-1">
                      {gapAnalysis.matched_skills.map((s, i) => (
                        <li key={i} className="text-xs text-green-700 flex items-start gap-1">
                          <span className="mt-0.5 shrink-0">•</span>{s.skill}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-amber-800 mb-2">~ Partial Matches</h3>
                    <ul className="space-y-1">
                      {gapAnalysis.partial_skills.map((s, i) => (
                        <li key={i} className="text-xs text-amber-700 flex items-start gap-1">
                          <span className="mt-0.5 shrink-0">•</span>{s.skill}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-red-800 mb-2">✗ Missing Skills</h3>
                    <ul className="space-y-1">
                      {gapAnalysis.missing_skills.map((s, i) => (
                        <li key={i} className="text-xs text-red-700 flex items-start gap-1">
                          <span className="mt-0.5 shrink-0">•</span>{s.skill}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <button
                  onClick={handleGenerateQuestions}
                  disabled={generatingQuestions}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-3 text-sm font-medium disabled:opacity-50 transition"
                >
                  {generatingQuestions ? 'Generating questions...' : 'Continue — Generate Interview Questions →'}
                </button>
              </div>
            )
          })()}
        </div>
      )}

      {currentStep === 1 && (
        <div>
          {questions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-lg">Interactive Questions</h2>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="text-sm text-gray-500 hover:text-blue-600 underline"
                >
                  Skip questions and continue →
                </button>
              </div>
              {questions.map((q) => (
                <div key={q.id} className="border rounded p-4 space-y-2">
                  <p className="text-xs text-gray-500 uppercase">{q.target_skill}</p>
                  {q.existing_bullet && (
                    <p className="text-xs text-gray-400 italic">Current: &quot;{q.existing_bullet}&quot;</p>
                  )}
                  <p className="text-sm font-medium">{q.question_text}</p>
                  <textarea
                    value={answers[q.id] || ''}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    placeholder="Type your answer here..."
                    className="w-full border rounded px-3 py-2 h-24 text-sm"
                    maxLength={5000}
                  />
                  <button
                    onClick={() => handleSubmitAnswer(q.id, q.question_text, q.existing_bullet || '')}
                    disabled={submittingAnswer === q.id}
                    className="bg-gray-800 text-white rounded px-3 py-1.5 text-sm disabled:opacity-50"
                  >
                    {submittingAnswer === q.id ? 'Processing...' : 'Submit answer'}
                  </button>

                  {extractedResults[q.id] && (
                    <div className="space-y-2">
                      <div className="bg-red-50 border border-red-200 rounded p-3 text-sm">
                        <p className="text-xs uppercase text-red-700 mb-1">Before</p>
                        <p>{q.existing_bullet}</p>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded p-3 text-sm">
                        <p className="text-xs uppercase text-green-700 mb-1">After</p>
                        <p>{extractedResults[q.id].rewritten_bullet}</p>
                      </div>
                      <p className="text-xs text-gray-500"><span className="font-medium">Skill identified:</span> {extractedResults[q.id].skill_identified}</p>
                    </div>
                  )}

                  {extractedResults[q.id] && (
                    <label className="flex items-center gap-2 text-sm mt-2">
                      <input
                        type="checkbox"
                        checked={approvalChoices[q.id] || false}
                        onChange={(e) => setApprovalChoices((prev) => ({ ...prev, [q.id]: e.target.checked }))}
                      />
                      Add this to my resume
                    </label>
                  )}
                </div>
              ))}

              {Object.values(extractedResults).length > 0 && (
                <div className="border-t pt-4">
                  {validationSaved ? (
                    <p className="text-green-700 text-sm font-medium">✓ Your selections have been saved.</p>
                  ) : (
                    <button
                      onClick={handleSaveValidation}
                      disabled={savingValidation}
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2 disabled:opacity-50"
                    >
                      {savingValidation ? 'Saving...' : 'Save my selections'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {currentStep === 2 && (
        <div>
          {validationSaved && (
            <div className="space-y-4">
              <h2 className="font-medium text-lg">Final Output</h2>

              <button
                onClick={handleGenerateResume}
                disabled={generatingResume}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2 disabled:opacity-50 mr-2"
              >
                {generatingResume ? 'Generating resume...' : 'Generate optimized resume'}
              </button>

              {finalResume && (
                <div className="border rounded-lg p-5 space-y-6 bg-white">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-base">
                      {finalResume.document_title || 'Resume'} — Editable Preview
                    </h3>
                    <button
                      onClick={handleDownloadPdf}
                      disabled={downloadingPdf}
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-1.5 text-sm disabled:opacity-50"
                    >
                      {downloadingPdf ? 'Generating PDF...' : 'Download PDF'}
                    </button>
                  </div>

                  {/* Contact */}
                  <section>
                    <h4 className="text-xs font-semibold uppercase text-gray-500 mb-2">Contact</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {((['name', 'email', 'phone', 'location', 'linkedin'] as const)).map((field) => (
                        <div key={field}>
                          <label className="block text-xs text-gray-500 mb-0.5 capitalize">{field}</label>
                          <input
                            type="text"
                            value={finalResume.contact[field] ?? ''}
                            onChange={(e) => updateContactField(field, e.target.value)}
                            className="w-full border rounded px-2 py-1 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Summary */}
                  {finalResume.summary !== undefined && (
                    <section>
                      <h4 className="text-xs font-semibold uppercase text-gray-500 mb-2">Summary</h4>
                      <textarea
                        value={finalResume.summary ?? ''}
                        onChange={(e) => updateSummary(e.target.value)}
                        className="w-full border rounded px-2 py-1 text-sm h-24 resize-y"
                      />
                    </section>
                  )}

                  {/* Work Experience */}
                  <section>
                    <h4 className="text-xs font-semibold uppercase text-gray-500 mb-2">Work Experience</h4>
                    <div className="space-y-4">
                      {finalResume.work_experience.map((exp, expIdx) => (
                        <div key={expIdx} className="border rounded p-3 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-gray-500 mb-0.5">Title</label>
                              <input
                                type="text"
                                value={exp.title}
                                onChange={(e) => updateWorkField(expIdx, 'title', e.target.value)}
                                className="w-full border rounded px-2 py-1 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-0.5">Company</label>
                              <input
                                type="text"
                                value={exp.company}
                                onChange={(e) => updateWorkField(expIdx, 'company', e.target.value)}
                                className="w-full border rounded px-2 py-1 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-0.5">Start</label>
                              <input
                                type="text"
                                value={exp.start_date ?? ''}
                                onChange={(e) => updateWorkField(expIdx, 'start_date', e.target.value)}
                                className="w-full border rounded px-2 py-1 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-0.5">End</label>
                              <input
                                type="text"
                                value={exp.end_date ?? ''}
                                onChange={(e) => updateWorkField(expIdx, 'end_date', e.target.value)}
                                className="w-full border rounded px-2 py-1 text-sm"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Responsibilities</label>
                            <div className="space-y-1">
                              {exp.responsibilities.map((resp, respIdx) => (
                                <div key={respIdx} className="flex gap-1 items-start">
                                  <textarea
                                    value={resp}
                                    onChange={(e) => updateWorkResponsibility(expIdx, respIdx, e.target.value)}
                                    className="flex-1 border rounded px-2 py-1 text-sm h-16 resize-y"
                                  />
                                  <button
                                    onClick={() => removeWorkResponsibility(expIdx, respIdx)}
                                    className="text-red-500 text-xs px-1 py-1 hover:text-red-700 flex-shrink-0"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                            </div>
                            <button
                              onClick={() => addWorkResponsibility(expIdx)}
                              className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                            >
                              + Add bullet
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Skills */}
                  <section>
                    <h4 className="text-xs font-semibold uppercase text-gray-500 mb-2">Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {finalResume.skills.map((skill, i) => (
                        <div key={i} className="flex items-center gap-0.5 border rounded px-1 py-0.5">
                          <input
                            type="text"
                            value={skill}
                            onChange={(e) => updateSkill(i, e.target.value)}
                            className="text-xs w-28 outline-none"
                          />
                          <button
                            onClick={() => removeSkill(i)}
                            className="text-red-400 hover:text-red-600 text-xs leading-none"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={addSkill}
                        className="text-xs text-blue-600 hover:text-blue-800 border border-dashed rounded px-2 py-0.5"
                      >
                        + Add skill
                      </button>
                    </div>
                  </section>

                  {/* Certifications */}
                  {(finalResume.certifications.length > 0 || true) && (
                    <section>
                      <h4 className="text-xs font-semibold uppercase text-gray-500 mb-2">Certifications</h4>
                      <div className="space-y-1">
                        {finalResume.certifications.map((cert, i) => (
                          <div key={i} className="flex gap-1 items-center">
                            <input
                              type="text"
                              value={cert}
                              onChange={(e) => updateCertification(i, e.target.value)}
                              className="flex-1 border rounded px-2 py-1 text-sm"
                            />
                            <button
                              onClick={() => removeCertification(i)}
                              className="text-red-500 text-xs px-1 hover:text-red-700"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={addCertification}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          + Add certification
                        </button>
                      </div>
                    </section>
                  )}

                  {/* Education (read-only) */}
                  <section>
                    <h4 className="text-xs font-semibold uppercase text-gray-500 mb-2">Education</h4>
                    <div className="space-y-1">
                      {finalResume.education.map((edu, i) => (
                        <div key={i} className="text-sm">
                          <span className="font-medium">{edu.degree}</span> — {edu.institution}
                          {(edu.start_date || edu.end_date) && (
                            <span className="text-gray-500 ml-2 text-xs">{edu.start_date} – {edu.end_date}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              )}

              {finalResume && (
                <div>
                  <button
                    onClick={handleGenerateCoverLetter}
                    disabled={generatingCoverLetter}
                    className="border rounded px-4 py-2 text-sm hover:border-blue-600 disabled:opacity-50"
                  >
                    {generatingCoverLetter ? 'Generating cover letter...' : 'Generate cover letter (optional)'}
                  </button>

                  {coverLetter && (
                    <div className="space-y-2 mt-3">
                      <a
                        href="/api/cover-letter/pdf"
                        className="inline-block border rounded px-4 py-2 text-sm hover:border-blue-600"
                      >
                        Download cover letter PDF
                      </a>
                      <div className="bg-gray-50 border rounded p-4 text-sm whitespace-pre-wrap">
                        {coverLetter}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {finalResume && (
                <div>
                  <button
                    onClick={handleGenerateNetworking}
                    disabled={generatingNetworking}
                    className="border rounded px-4 py-2 text-sm hover:border-blue-600 disabled:opacity-50"
                  >
                    {generatingNetworking ? 'Generating suggestions...' : 'Get networking suggestions'}
                  </button>

                  {networkingSuggestions.length > 0 && (
                    <div className="space-y-2 mt-3">
                      {networkingSuggestions.map((s, i) => (
                        <div key={i} className="border rounded p-3 text-sm">
                          <p className="text-xs uppercase text-gray-500 mb-1">{s.category}</p>
                          <p>{s.suggestion_text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {finalResume && (
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-3 text-sm font-medium mt-4"
            >
              Finish → Go to Dashboard
            </button>
          )}
        </div>
      )}

      <div className="flex justify-between items-center border-t pt-4 mt-8">
        <button
          onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
          disabled={currentStep === 0}
          className="border rounded px-4 py-2 text-sm hover:border-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ← Back
        </button>
        <span className="text-xs text-gray-400">Step {currentStep + 1} of 3</span>
        <button
          onClick={() => setCurrentStep((s) => Math.min(2, s + 1))}
          disabled={currentStep === 2}
          className="border rounded px-4 py-2 text-sm hover:border-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Continue →
        </button>
      </div>
    </div>
  )
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<div className="max-w-3xl mx-auto mt-12 text-center text-gray-500">Loading...</div>}>
      <ReviewPageContent />
    </Suspense>
  )
}

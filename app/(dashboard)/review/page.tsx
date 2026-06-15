'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

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
  const searchParams = useSearchParams()
  const resumeId = searchParams.get('resume_id')
  const jdId = searchParams.get('jd_id')

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
  const [preflightChecks, setPreflightChecks] = useState<Array<{ type: string; jd_requirement: string; guidance: string }>>([])
  const [loadingPreflight, setLoadingPreflight] = useState(false)
  const [preflightChecked, setPreflightChecked] = useState(false)
  const [preflightResponses, setPreflightResponses] = useState<Record<number, 'yes' | 'no' | 'unsure'>>({})
  const [currentStep, setCurrentStep] = useState(0)

  async function handlePreflightCheck() {
    if (!jdId) {
      setError('Missing job description ID.')
      return
    }

    setLoadingPreflight(true)
    setError(null)

    try {
      const res = await fetch('/api/jd/preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jd_id: jdId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        return
      }

      setPreflightChecks(data.checks)
      setPreflightChecked(true)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoadingPreflight(false)
    }
  }

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
    console.log('[DEBUG] preflightChecks:', JSON.stringify(preflightChecks))
    console.log('[DEBUG] preflightResponses:', JSON.stringify(preflightResponses))
    preflightChecks.forEach((check, i) => {
      const response = preflightResponses[i]
      if (response === 'yes') {
        if (check.type === 'driving_license') {
          preflightFacts.push('Candidate holds a valid driving license.')
        } else if (check.type === 'work_authorization') {
          preflightFacts.push('Candidate has confirmed right to work in the target country.')
        } else if (check.type === 'relocation') {
          preflightFacts.push('Candidate is willing to relocate for this role.')
        } else if (check.type === 'visa') {
          preflightFacts.push('Candidate is eligible for or interested in visa sponsorship for this role.')
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
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {currentStep === 0 && (
        <div>
          {!preflightChecked && (
            <div className="mb-6">
              <button
                onClick={handlePreflightCheck}
                disabled={loadingPreflight}
                className="border rounded px-4 py-2 text-sm hover:border-black disabled:opacity-50"
              >
                {loadingPreflight ? 'Checking job requirements...' : 'Run pre-flight check on this job'}
              </button>
            </div>
          )}

          {preflightChecked && preflightChecks.length > 0 && (
            <div className="space-y-2 mb-6">
              <h2 className="font-medium text-lg text-amber-700">Before you apply — things to verify</h2>
              {preflightChecks.map((check, i) => (
                <div key={i} className="border border-amber-300 bg-amber-50 rounded p-3 text-sm">
                  <p className="text-xs uppercase text-amber-700 mb-1">{check.type.replace('_', ' ')}</p>
                  <p className="font-medium">{check.jd_requirement}</p>
                  <p className="text-gray-700 mt-1">{check.guidance}</p>
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs text-gray-600 self-center">Does this apply to you?</span>
                    {(['yes', 'no', 'unsure'] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setPreflightResponses((prev) => ({ ...prev, [i]: option }))}
                        className={`text-xs px-2 py-1 rounded border ${
                          preflightResponses[i] === option
                            ? 'bg-black text-white border-black'
                            : 'bg-white border-gray-300 hover:border-black'
                        }`}
                      >
                        {option === 'yes' ? 'Yes' : option === 'no' ? 'No' : 'Not sure'}
                      </button>
                    ))}
                  </div>
                  {check.type === 'visa' && preflightResponses[i] === 'no' && check.jd_requirement.toLowerCase().includes('sponsorship') === false && (
                    <p className="text-red-700 text-xs mt-2 font-medium">
                      ⚠ This may be a blocker for this role. Consider whether to proceed with this application.
                    </p>
                  )}
                  {(check.type === 'driving_license' || check.type === 'work_authorization') && preflightResponses[i] === 'yes' && (
                    <p className="text-green-700 text-xs mt-2">
                      ✓ This will be noted for your resume.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {preflightChecked && preflightChecks.length === 0 && (
            <div className="mb-6">
              <p className="text-sm text-green-700">✓ No special visa, license, or relocation requirements detected for this role.</p>
            </div>
          )}
        </div>
      )}

      {currentStep === 1 && (
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold">Review your parsed resume</h1>
          <p className="text-sm text-gray-500">resume_id: {resumeId} | jd_id: {jdId}</p>

          <button
            onClick={handleParse}
            disabled={loading || !resumeId}
            className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
          >
            {loading ? 'Parsing...' : 'Parse my resume'}
          </button>

          {parsed && (
            <div className="space-y-6">
              <section>
                <h2 className="font-medium text-lg mb-2">Contact</h2>
                <pre className="bg-gray-50 border rounded p-3 text-sm overflow-x-auto">
                  {JSON.stringify(parsed.contact, null, 2)}
                </pre>
              </section>

              {parsed.summary && (
                <section>
                  <h2 className="font-medium text-lg mb-2">Summary</h2>
                  <p className="text-sm bg-gray-50 border rounded p-3">{parsed.summary}</p>
                </section>
              )}

              <section>
                <h2 className="font-medium text-lg mb-2">Work Experience ({parsed.work_experience.length})</h2>
                <div className="space-y-3">
                  {parsed.work_experience.map((exp, i) => (
                    <div key={i} className="border rounded p-3 text-sm">
                      <p className="font-medium">{exp.title} — {exp.company}</p>
                      <p className="text-gray-500">{exp.start_date} to {exp.end_date} {exp.location && `• ${exp.location}`}</p>
                      <ul className="list-disc pl-5 mt-1">
                        {exp.responsibilities.map((r, j) => <li key={j}>{r}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="font-medium text-lg mb-2">Education ({parsed.education.length})</h2>
                <div className="space-y-2">
                  {parsed.education.map((edu, i) => (
                    <div key={i} className="border rounded p-3 text-sm">
                      <p className="font-medium">{edu.degree} — {edu.institution}</p>
                      <p className="text-gray-500">{edu.start_date} to {edu.end_date}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="font-medium text-lg mb-2">Skills ({parsed.skills.length})</h2>
                <div className="flex flex-wrap gap-2">
                  {parsed.skills.map((skill, i) => (
                    <span key={i} className="bg-gray-100 border rounded px-2 py-1 text-xs">{skill}</span>
                  ))}
                </div>
              </section>

              {parsed.projects.length > 0 && (
                <section>
                  <h2 className="font-medium text-lg mb-2">Projects ({parsed.projects.length})</h2>
                  <div className="space-y-2">
                    {parsed.projects.map((proj, i) => (
                      <div key={i} className="border rounded p-3 text-sm">
                        <p className="font-medium">{proj.name}</p>
                        <p>{proj.description}</p>
                        <p className="text-gray-500 text-xs mt-1">{proj.technologies.join(', ')}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {parsed.certifications.length > 0 && (
                <section>
                  <h2 className="font-medium text-lg mb-2">Certifications</h2>
                  <ul className="list-disc pl-5 text-sm">
                    {parsed.certifications.map((cert, i) => <li key={i}>{cert}</li>)}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>
      )}

      {currentStep === 2 && (
        <div className="space-y-6">
          <button
            onClick={handleAnalyzeGap}
            disabled={analyzing}
            className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
          >
            {analyzing ? 'Analyzing...' : 'Analyze skill gaps vs JD'}
          </button>

          {gapAnalysis && (
            <div className="space-y-6">
              <section>
                <h2 className="font-medium text-lg mb-2 text-green-700">Matched Skills ({gapAnalysis.matched_skills.length})</h2>
                <div className="space-y-2">
                  {gapAnalysis.matched_skills.map((s, i) => (
                    <div key={i} className="border rounded p-3 text-sm bg-green-50">
                      <p className="font-medium">{s.skill}</p>
                      <p className="text-gray-600 text-xs">{s.evidence}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="font-medium text-lg mb-2 text-amber-700">Partial Matches ({gapAnalysis.partial_skills.length})</h2>
                <div className="space-y-2">
                  {gapAnalysis.partial_skills.map((s, i) => (
                    <div key={i} className="border rounded p-3 text-sm bg-amber-50">
                      <p className="font-medium">{s.skill}</p>
                      <p className="text-gray-600 text-xs">Resume shows: {s.resume_evidence}</p>
                      <p className="text-gray-600 text-xs">JD wants: {s.jd_requirement}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="font-medium text-lg mb-2 text-red-700">Missing Skills ({gapAnalysis.missing_skills.length})</h2>
                <div className="space-y-2">
                  {gapAnalysis.missing_skills.map((s, i) => (
                    <div key={i} className="border rounded p-3 text-sm bg-red-50">
                      <p className="font-medium">{s.skill}</p>
                      <p className="text-gray-600 text-xs">{s.jd_context}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {gapAnalysis && (
            <button
              onClick={handleGenerateQuestions}
              disabled={generatingQuestions}
              className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
            >
              {generatingQuestions ? 'Generating questions...' : 'Generate interactive questions'}
            </button>
          )}
        </div>
      )}

      {currentStep === 3 && (
        <div>
          {questions.length > 0 && (
            <div className="space-y-4">
              <h2 className="font-medium text-lg">Interactive Questions</h2>
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
                      className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
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

      {currentStep === 4 && (
        <div>
          {validationSaved && (
            <div className="space-y-4">
              <h2 className="font-medium text-lg">Final Output</h2>

              {preflightChecked && (
                <div className="border rounded p-4 bg-gray-50 space-y-2">
                  <h3 className="font-medium text-sm uppercase text-gray-500">Pre-Flight Audit Status</h3>
                  {preflightChecks.map((check, i) => {
                    const response = preflightResponses[i]
                    const label = check.type.replace('_', ' ').toUpperCase()
                    let statusIcon = '○'
                    let statusColor = 'text-gray-400'
                    let statusText = 'Not answered'

                    if (response === 'yes') {
                      statusIcon = '✓'
                      statusColor = 'text-green-600'
                      statusText = check.type === 'visa'
                        ? 'Visa sponsorship required / eligible'
                        : check.type === 'driving_license'
                        ? 'Holds a valid driving license'
                        : check.type === 'work_authorization'
                        ? 'Has right to work confirmed'
                        : 'Willing to relocate'
                    } else if (response === 'no') {
                      statusIcon = '✗'
                      statusColor = 'text-red-600'
                      statusText = check.type === 'visa'
                        ? 'No visa sponsorship needed / not eligible'
                        : check.type === 'driving_license'
                        ? 'Does not hold a driving license'
                        : check.type === 'work_authorization'
                        ? 'Right to work not confirmed'
                        : 'Not willing to relocate'
                    } else if (response === 'unsure') {
                      statusIcon = '!'
                      statusColor = 'text-amber-600'
                      statusText = 'Marked as unsure — verify before applying'
                    }

                    return (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className={`font-mono ${statusColor}`}>[{statusIcon}]</span>
                        <div>
                          <span className="font-medium">{label}:</span> <span className={statusColor}>{statusText}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <button
                onClick={handleGenerateResume}
                disabled={generatingResume}
                className="bg-black text-white rounded px-4 py-2 disabled:opacity-50 mr-2"
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
                      className="bg-black text-white rounded px-3 py-1.5 text-sm disabled:opacity-50"
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
                    className="border rounded px-4 py-2 text-sm hover:border-black disabled:opacity-50"
                  >
                    {generatingCoverLetter ? 'Generating cover letter...' : 'Generate cover letter (optional)'}
                  </button>

                  {coverLetter && (
                    <div className="space-y-2 mt-3">
                      <a
                        href="/api/cover-letter/pdf"
                        className="inline-block border rounded px-4 py-2 text-sm hover:border-black"
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
                    className="border rounded px-4 py-2 text-sm hover:border-black disabled:opacity-50"
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
        </div>
      )}

      <div className="flex justify-between items-center border-t pt-4 mt-8">
        <button
          onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
          disabled={currentStep === 0}
          className="border rounded px-4 py-2 text-sm hover:border-black disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ← Back
        </button>
        <span className="text-xs text-gray-400">Step {currentStep + 1} of 5</span>
        <button
          onClick={() => setCurrentStep((s) => Math.min(4, s + 1))}
          disabled={currentStep === 4}
          className="border rounded px-4 py-2 text-sm hover:border-black disabled:opacity-30 disabled:cursor-not-allowed"
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

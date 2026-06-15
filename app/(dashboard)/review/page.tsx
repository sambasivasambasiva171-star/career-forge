'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

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

export default function ReviewPage() {
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
  const [questions, setQuestions] = useState<Array<{ id: string; target_skill: string; question_text: string }>>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submittingAnswer, setSubmittingAnswer] = useState<string | null>(null)
  const [extractedResults, setExtractedResults] = useState<Record<string, { skill_identified: string; resume_bullet: string }>>({})
  const [approvalChoices, setApprovalChoices] = useState<Record<string, boolean>>({})
  const [savingValidation, setSavingValidation] = useState(false)
  const [validationSaved, setValidationSaved] = useState(false)
  const [generatingResume, setGeneratingResume] = useState(false)
  const [finalResume, setFinalResume] = useState<object | null>(null)
  const [generatingCoverLetter, setGeneratingCoverLetter] = useState(false)
  const [coverLetter, setCoverLetter] = useState<string | null>(null)
  const [generatingNetworking, setGeneratingNetworking] = useState(false)
  const [networkingSuggestions, setNetworkingSuggestions] = useState<Array<{ category: string; suggestion_text: string }>>([])
  const [preflightChecks, setPreflightChecks] = useState<Array<{ type: string; jd_requirement: string; guidance: string }>>([])
  const [loadingPreflight, setLoadingPreflight] = useState(false)
  const [preflightChecked, setPreflightChecked] = useState(false)
  const [preflightResponses, setPreflightResponses] = useState<Record<number, 'yes' | 'no' | 'unsure'>>({})

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

  async function handleSubmitAnswer(questionId: string, questionText: string) {
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
        body: JSON.stringify({ jd_id: jdId, question: questionText, answer: answer.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        return
      }

      setExtractedResults((prev) => ({
        ...prev,
        [questionId]: { skill_identified: data.skill_identified, resume_bullet: data.resume_bullet },
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
        resume_bullet: extractedResults[q.id].resume_bullet,
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

    try {
      const res = await fetch('/api/resume/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume_id: resumeId, jd_id: jdId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        return
      }

      setFinalResume(data.resume)
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
            </div>
          ))}
        </div>
      )}

      {preflightChecked && preflightChecks.length === 0 && (
        <div className="mb-6">
          <p className="text-sm text-green-700">✓ No special visa, license, or relocation requirements detected for this role.</p>
        </div>
      )}

      <h1 className="text-2xl font-semibold">Review your parsed resume</h1>
      <p className="text-sm text-gray-500">resume_id: {resumeId} | jd_id: {jdId}</p>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        onClick={handleParse}
        disabled={loading || !resumeId}
        className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
      >
        {loading ? 'Parsing...' : 'Parse my resume'}
      </button>

      {parsed && (
        <div className="space-y-6 mt-6">
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

      {parsed && (
        <button
          onClick={handleAnalyzeGap}
          disabled={analyzing}
          className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
        >
          {analyzing ? 'Analyzing...' : 'Analyze skill gaps vs JD'}
        </button>
      )}

      {gapAnalysis && (
        <div className="space-y-6 mt-6">
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

      {questions.length > 0 && (
        <div className="space-y-4 mt-6">
          <h2 className="font-medium text-lg">Interactive Questions</h2>
          {questions.map((q) => (
            <div key={q.id} className="border rounded p-4 space-y-2">
              <p className="text-xs text-gray-500 uppercase">{q.target_skill}</p>
              <p className="text-sm font-medium">{q.question_text}</p>
              <textarea
                value={answers[q.id] || ''}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                placeholder="Type your answer here..."
                className="w-full border rounded px-3 py-2 h-24 text-sm"
                maxLength={5000}
              />
              <button
                onClick={() => handleSubmitAnswer(q.id, q.question_text)}
                disabled={submittingAnswer === q.id}
                className="bg-gray-800 text-white rounded px-3 py-1.5 text-sm disabled:opacity-50"
              >
                {submittingAnswer === q.id ? 'Processing...' : 'Submit answer'}
              </button>

              {extractedResults[q.id] && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm space-y-1">
                  <p><span className="font-medium">Skill identified:</span> {extractedResults[q.id].skill_identified}</p>
                  <p><span className="font-medium">Suggested bullet:</span> {extractedResults[q.id].resume_bullet}</p>
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

      {validationSaved && (
        <div className="space-y-4 mt-8 border-t pt-6">
          <h2 className="font-medium text-lg">Final Output</h2>

          <button
            onClick={handleGenerateResume}
            disabled={generatingResume}
            className="bg-black text-white rounded px-4 py-2 disabled:opacity-50 mr-2"
          >
            {generatingResume ? 'Generating resume...' : 'Generate optimized resume'}
          </button>

          {finalResume && (
            <a
              href="/api/resume/pdf"
              className="inline-block border rounded px-4 py-2 text-sm hover:border-black"
            >
              Download PDF
            </a>
          )}

          {finalResume && (
            <pre className="bg-gray-50 border rounded p-3 text-xs overflow-x-auto max-h-96">
              {JSON.stringify(finalResume, null, 2)}
            </pre>
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
  )
}

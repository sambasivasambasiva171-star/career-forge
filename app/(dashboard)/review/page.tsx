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
    </div>
  )
}

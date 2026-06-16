'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import StepProgress from '@/components/StepProgress'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
const MAX_MANUAL_LENGTH = 20000
const MAX_JD_LENGTH = 10000

function UploadPageContent() {
  const [mode, setMode] = useState<'upload' | 'manual'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [manualText, setManualText] = useState('')
  const [jdText, setJdText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const existingResumeId = searchParams.get('resume_id') ||
    (typeof window !== 'undefined' ? sessionStorage.getItem('cf_resume_id') : null)
  const existingJdId = searchParams.get('jd_id') ||
    (typeof window !== 'undefined' ? sessionStorage.getItem('cf_jd_id') : null)
  const [existingFilename, setExistingFilename] = useState<string | null>(null)
  const [existingJdPreview, setExistingJdPreview] = useState<string | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(false)

  useEffect(() => {
    if (!existingResumeId || !existingJdId) return

    async function fetchExisting() {
      setLoadingExisting(true)
      const supabase = createClient()

      const [{ data: resume }, { data: jd }] = await Promise.all([
        supabase.from('resumes').select('parsed_json, source_type, raw_text').eq('id', existingResumeId).single(),
        supabase.from('job_descriptions').select('raw_text').eq('id', existingJdId).single(),
      ])

      if (resume) {
        const filename = (resume.parsed_json as { original_filename?: string })?.original_filename
          || (resume.source_type === 'manual' ? 'Manually entered resume' : 'Uploaded resume')
        setExistingFilename(filename)
      }

      if (jd?.raw_text) {
        setExistingJdPreview(jd.raw_text.slice(0, 300))
      }

      setLoadingExisting(false)
    }

    fetchExisting()
  }, [existingResumeId, existingJdId])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) { setFile(null); return }
    if (!ALLOWED_TYPES.includes(selected.type)) {
      setError('Please upload a PDF or Word document.')
      setFile(null)
      return
    }
    if (selected.size > MAX_FILE_SIZE) {
      setError('File must be 5MB or smaller.')
      setFile(null)
      return
    }
    setError(null)
    setFile(selected)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (mode === 'upload' && !file) {
      setError('Please select a resume file.')
      return
    }
    if (mode === 'manual' && !manualText.trim()) {
      setError('Please enter your work experience.')
      return
    }
    if (mode === 'manual' && manualText.length > MAX_MANUAL_LENGTH) {
      setError(`Resume text must be ${MAX_MANUAL_LENGTH} characters or fewer.`)
      return
    }
    if (!jdText.trim()) {
      setError('Please paste the job description.')
      return
    }
    if (jdText.length > MAX_JD_LENGTH) {
      setError(`Job description must be ${MAX_JD_LENGTH} characters or fewer.`)
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('You must be logged in.'); setLoading(false); return }

      let resumeId: string

      if (mode === 'upload' && file) {
        const timestamp = Date.now()
        const path = `${user.id}/${timestamp}_${file.name}`
        const { error: uploadError } = await supabase.storage.from('resumes').upload(path, file)
        if (uploadError) { setError('Failed to upload file. Please try again.'); setLoading(false); return }

        const { data: resumeRow, error: insertError } = await supabase
          .from('resumes')
          .insert({ user_id: user.id, source_type: 'upload', raw_text: null, parsed_json: { storage_path: path, original_filename: file.name } })
          .select('id').single()
        if (insertError || !resumeRow) { setError('Failed to save resume. Please try again.'); setLoading(false); return }
        resumeId = resumeRow.id

        fetch('/api/resume/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resume_id: resumeId }),
        }).catch(() => {})
      } else {
        const { data: resumeRow, error: insertError } = await supabase
          .from('resumes')
          .insert({ user_id: user.id, source_type: 'manual', raw_text: manualText, parsed_json: null })
          .select('id').single()
        if (insertError || !resumeRow) { setError('Failed to save resume. Please try again.'); setLoading(false); return }
        resumeId = resumeRow.id

        fetch('/api/resume/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resume_id: resumeId }),
        }).catch(() => {})
      }

      const { data: jdRow, error: jdError } = await supabase
        .from('job_descriptions')
        .insert({ user_id: user.id, raw_text: jdText, parsed_keywords: null })
        .select('id').single()
      if (jdError || !jdRow) { setError('Failed to save job description. Please try again.'); setLoading(false); return }

      router.push(`/review?resume_id=${resumeId}&jd_id=${jdRow.id}`)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4">
      <StepProgress current={2} />

      <div className="space-y-6 pb-12">
        <button
          type="button"
          onClick={() => router.push('/onboarding')}
          className="text-sm text-gray-500 hover:text-blue-600"
        >
          ← Back to Profile
        </button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Your Details</h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload your CV and paste the job description you&apos;re targeting — all in one step.
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-6">

          {existingResumeId && existingJdId && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-blue-900">Your previously uploaded CV &amp; JD</p>
                <button
                  type="button"
                  onClick={() => router.push(`/review?resume_id=${existingResumeId}&jd_id=${existingJdId}`)}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-1.5 text-sm font-medium shrink-0 ml-4"
                >
                  Continue with these →
                </button>
              </div>
              {loadingExisting ? (
                <p className="text-xs text-blue-600">Loading your saved data...</p>
              ) : (
                <>
                  {existingFilename && (
                    <div className="bg-white border border-blue-100 rounded p-2">
                      <p className="text-xs text-blue-700 font-medium mb-0.5">CV / Resume</p>
                      <p className="text-sm text-gray-700">📄 {existingFilename}</p>
                    </div>
                  )}
                  {existingJdPreview && (
                    <div className="bg-white border border-blue-100 rounded p-2">
                      <p className="text-xs text-blue-700 font-medium mb-0.5">Job Description (preview)</p>
                      <p className="text-sm text-gray-600 line-clamp-3">{existingJdPreview}{existingJdPreview.length === 300 ? '...' : ''}</p>
                    </div>
                  )}
                  <p className="text-xs text-blue-600">Or upload a new CV and JD below to start fresh.</p>
                </>
              )}
            </div>
          )}

          {/* Resume section */}
          <div className="bg-white border rounded-lg p-4 shadow-sm space-y-3">
            <h2 className="font-medium text-gray-900">Your CV / Resume</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('upload')}
                className={`text-sm border rounded px-3 py-1.5 transition ${mode === 'upload' ? 'border-blue-600 bg-blue-50 text-blue-600 font-medium' : 'border-gray-200 text-gray-600 hover:border-blue-600'}`}
              >
                Upload existing resume
              </button>
              <button
                type="button"
                onClick={() => setMode('manual')}
                className={`text-sm border rounded px-3 py-1.5 transition ${mode === 'manual' ? 'border-blue-600 bg-blue-50 text-blue-600 font-medium' : 'border-gray-200 text-gray-600 hover:border-blue-600'}`}
              >
                Type it manually
              </button>
            </div>

            {mode === 'upload' ? (
              <div className="border-2 border-dashed rounded-lg p-6 text-center bg-gray-50">
                <p className="text-sm text-gray-500 mb-2">PDF or Word, max 5MB</p>
                <input type="file" accept=".pdf,.docx" onChange={handleFileChange} />
                {file && <p className="text-sm mt-2 text-gray-700">Selected: <span className="font-medium">{file.name}</span></p>}
              </div>
            ) : (
              <textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="Paste or type your work experience, education, and skills..."
                className="w-full h-40 border rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-blue-600"
                maxLength={MAX_MANUAL_LENGTH}
              />
            )}
          </div>

          {/* JD section */}
          <div className="bg-white border rounded-lg p-4 shadow-sm space-y-3">
            <h2 className="font-medium text-gray-900">Job Description</h2>
            <p className="text-xs text-gray-500">Paste the exact job description you&apos;re applying for. The AI will tailor your CV to match it.</p>
            <textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste the full job description here..."
              className="w-full h-48 border rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-blue-600"
              maxLength={MAX_JD_LENGTH}
            />
            <p className="text-xs text-gray-400 text-right">{jdText.length}/{MAX_JD_LENGTH} characters</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-3 text-sm font-medium disabled:opacity-50 transition"
          >
            {loading ? 'Saving...' : 'Continue to Generate CV →'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function UploadPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto px-4 py-12 text-gray-500">Loading...</div>}>
      <UploadPageContent />
    </Suspense>
  )
}

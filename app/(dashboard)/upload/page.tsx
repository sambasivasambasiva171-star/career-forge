'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import StepProgress from '@/components/StepProgress'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
const MAX_MANUAL_LENGTH = 20000

export default function UploadPage() {
  const [mode, setMode] = useState<'upload' | 'manual'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [manualText, setManualText] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) {
      setFile(null)
      return
    }
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

    setLoading(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setError('You must be logged in.')
        setLoading(false)
        return
      }

      let resumeId: string

      if (mode === 'upload' && file) {
        const timestamp = Date.now()
        const path = `${user.id}/${timestamp}_${file.name}`

        const { error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(path, file)

        if (uploadError) {
          setError('Failed to upload file. Please try again.')
          setLoading(false)
          return
        }

        const { data: resumeRow, error: insertError } = await supabase
          .from('resumes')
          .insert({
            user_id: user.id,
            source_type: 'upload',
            raw_text: null,
            parsed_json: { storage_path: path, original_filename: file.name },
          })
          .select('id')
          .single()

        if (insertError || !resumeRow) {
          setError('Failed to save resume. Please try again.')
          setLoading(false)
          return
        }

        resumeId = resumeRow.id

        // Parse the resume immediately so Step 2 can show editable personal info
        try {
          await fetch('/api/resume/parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resume_id: resumeId }),
          })
        } catch {
          // Non-fatal: parsing can be retried later in the flow
        }
      } else {
        const { data: resumeRow, error: insertError } = await supabase
          .from('resumes')
          .insert({
            user_id: user.id,
            source_type: 'manual',
            raw_text: manualText,
            parsed_json: null,
          })
          .select('id')
          .single()

        if (insertError || !resumeRow) {
          setError('Failed to save resume. Please try again.')
          setLoading(false)
          return
        }

        resumeId = resumeRow.id

        try {
          await fetch('/api/resume/parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resume_id: resumeId }),
          })
        } catch {
          // Non-fatal
        }
      }

      if (targetRole.trim()) {
        await supabase
          .from('job_descriptions')
          .upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true })
          .select()
        // Target role is carried via query param to the next step rather than persisted
        // here, since job_descriptions rows are created per-JD in the next step.
      }

      const params = new URLSearchParams({ resume_id: resumeId })
      if (targetRole.trim()) params.set('target_role', targetRole.trim())
      router.push(`/job-description?${params.toString()}`)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4">
      <StepProgress current={2} />

      <div className="space-y-6 pb-12">
        <div>
          <h1 className="text-xl font-semibold">Auto-fill from your existing CV</h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload your existing CV to auto-fill the form, or fill in your details manually.
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('upload')}
                className={`text-sm border rounded px-3 py-1.5 ${mode === 'upload' ? 'border-black bg-gray-50' : 'border-gray-200'}`}
              >
                Upload existing resume
              </button>
              <button
                type="button"
                onClick={() => setMode('manual')}
                className={`text-sm border rounded px-3 py-1.5 ${mode === 'manual' ? 'border-black bg-gray-50' : 'border-gray-200'}`}
              >
                Type it manually
              </button>
            </div>

            {mode === 'upload' ? (
              <div className="border-2 border-dashed rounded p-6 text-center">
                <input type="file" accept=".pdf,.docx" onChange={handleFileChange} />
                <p className="text-xs text-gray-500 mt-2">PDF or Word, max 5MB</p>
                {file && <p className="text-sm mt-2">Selected: {file.name}</p>}
              </div>
            ) : (
              <textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="Paste or type your work experience..."
                className="w-full h-48 border rounded p-3 text-sm"
                maxLength={MAX_MANUAL_LENGTH}
              />
            )}
          </div>

          <div className="border rounded p-4 space-y-2">
            <h2 className="font-medium">Target Role *</h2>
            <input
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="e.g. Software Engineer, Data Analyst, Marketing Manager"
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-500">
              The AI will tailor the CV to this specific role and extract matching keywords from your JD.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white rounded px-4 py-3 text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Continue to Job Description →'}
          </button>
        </form>
      </div>
    </div>
  )
}

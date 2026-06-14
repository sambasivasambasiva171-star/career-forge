'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
const MAX_JD_LENGTH = 10000
const MAX_MANUAL_LENGTH = 20000

export default function UploadPage() {
  const [mode, setMode] = useState<'upload' | 'manual'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [manualText, setManualText] = useState('')
  const [jdText, setJdText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return

    if (!ALLOWED_TYPES.includes(f.type)) {
      setError('Please upload a PDF or Word document.')
      setFile(null)
      return
    }

    if (f.size > MAX_FILE_SIZE) {
      setError('File too large. Maximum size is 5MB.')
      setFile(null)
      return
    }

    setError(null)
    setFile(f)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!jdText.trim()) {
      setError('Please paste the job description you\'re targeting.')
      return
    }

    if (jdText.length > MAX_JD_LENGTH) {
      setError(`Job description is too long (max ${MAX_JD_LENGTH} characters).`)
      return
    }

    if (mode === 'upload' && !file) {
      setError('Please select a resume file to upload.')
      return
    }

    if (mode === 'manual' && !manualText.trim()) {
      setError('Please enter your resume details.')
      return
    }

    if (mode === 'manual' && manualText.length > MAX_MANUAL_LENGTH) {
      setError(`Resume text is too long (max ${MAX_MANUAL_LENGTH} characters).`)
      return
    }

    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    try {
      let resumeRecord: { id: string }

      if (mode === 'upload' && file) {
        // Upload file to storage
        const filePath = `${user.id}/${Date.now()}_${file.name}`
        const { error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(filePath, file)

        if (uploadError) throw uploadError

        // Create resume record (raw_text will be filled by parsing step later)
        const { data, error: insertError } = await supabase
          .from('resumes')
          .insert({
            user_id: user.id,
            source_type: 'upload',
            raw_text: null, // populated by parsing API
            parsed_json: { storage_path: filePath, original_filename: file.name },
          })
          .select('id')
          .single()

        if (insertError) throw insertError
        resumeRecord = data
      } else {
        // Manual entry
        const { data, error: insertError } = await supabase
          .from('resumes')
          .insert({
            user_id: user.id,
            source_type: 'manual',
            raw_text: manualText.trim(),
            parsed_json: null,
          })
          .select('id')
          .single()

        if (insertError) throw insertError
        resumeRecord = data
      }

      // Save JD
      const { data: jdRecord, error: jdError } = await supabase
        .from('job_descriptions')
        .insert({
          user_id: user.id,
          raw_text: jdText.trim(),
          parsed_keywords: null,
        })
        .select('id')
        .single()

      if (jdError) throw jdError

      // Pass IDs forward via query params (or store in session/context)
      router.push(`/review?resume_id=${resumeRecord.id}&jd_id=${jdRecord.id}`)
    } catch (err) {
      console.error(err)
      setError('Something went wrong while saving your information. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto mt-12 space-y-6 pb-12">
      <h1 className="text-2xl font-semibold">Tell us about your background</h1>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Resume input */}
        <div>
          <h2 className="font-medium mb-2">Your resume</h2>
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setMode('upload')}
              className={`px-4 py-2 rounded text-sm ${mode === 'upload' ? 'bg-black text-white' : 'border'}`}
            >
              Upload existing resume
            </button>
            <button
              type="button"
              onClick={() => setMode('manual')}
              className={`px-4 py-2 rounded text-sm ${mode === 'manual' ? 'bg-black text-white' : 'border'}`}
            >
              Type it manually
            </button>
          </div>

          {mode === 'upload' ? (
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".pdf,.docx"
                onChange={handleFileChange}
                className="block w-full text-sm"
              />
              <p className="text-xs text-gray-500 mt-2">PDF or Word, max 5MB</p>
              {file && <p className="text-sm mt-2 text-green-700">Selected: {file.name}</p>}
            </div>
          ) : (
            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="Paste or type your work experience, education, skills, projects, etc."
              className="w-full border rounded px-3 py-2 h-48"
              maxLength={MAX_MANUAL_LENGTH}
            />
          )}
        </div>

        {/* JD input */}
        <div>
          <h2 className="font-medium mb-2">Job description you&apos;re targeting</h2>
          <textarea
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            placeholder="Paste the exact job description here."
            className="w-full border rounded px-3 py-2 h-48"
            maxLength={MAX_JD_LENGTH}
          />
          <p className="text-xs text-gray-500 mt-1">{jdText.length}/{MAX_JD_LENGTH} characters</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white rounded py-2 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Continue'}
        </button>
      </form>
    </div>
  )
}

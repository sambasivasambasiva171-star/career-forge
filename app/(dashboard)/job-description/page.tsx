'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import StepProgress from '@/components/StepProgress'

const MAX_JD_LENGTH = 10000

function JobDescriptionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resumeId = searchParams.get('resume_id')
  const targetRole = searchParams.get('target_role') || ''

  const [jdText, setJdText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!resumeId) {
      setError('Missing resume. Please go back and complete the previous step.')
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

      if (!user) {
        setError('You must be logged in.')
        setLoading(false)
        return
      }

      const { data: jdRow, error: insertError } = await supabase
        .from('job_descriptions')
        .insert({
          user_id: user.id,
          raw_text: jdText,
          parsed_keywords: null,
        })
        .select('id')
        .single()

      if (insertError || !jdRow) {
        setError('Failed to save job description. Please try again.')
        setLoading(false)
        return
      }

      router.push(`/review?resume_id=${resumeId}&jd_id=${jdRow.id}`)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4">
      <StepProgress current={3} />

      <div className="space-y-6 pb-12">
        <div>
          <h1 className="text-xl font-semibold">Find Matching Jobs</h1>
          <p className="text-sm text-gray-500 mt-1">
            Paste the job description you&apos;re targeting. The AI will tailor your CV to match it.
          </p>
        </div>

        {targetRole && (
          <div className="text-sm bg-gray-50 border rounded px-3 py-2">
            Target role: <span className="font-medium">{targetRole}</span>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <h2 className="font-medium">Job description</h2>
            <textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste the exact job description here."
              className="w-full h-64 border rounded p-3 text-sm"
              maxLength={MAX_JD_LENGTH}
            />
            <p className="text-xs text-gray-500 text-right">{jdText.length}/{MAX_JD_LENGTH} characters</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white rounded px-4 py-3 text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Continue to Generate CV →'}
          </button>

          <button
            type="button"
            onClick={() => router.push('/upload')}
            className="w-full border rounded px-4 py-3 text-sm font-medium"
          >
            ← Back
          </button>
        </form>
      </div>
    </div>
  )
}

export default function JobDescriptionPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto px-4 py-12 text-gray-500">Loading...</div>}>
      <JobDescriptionContent />
    </Suspense>
  )
}

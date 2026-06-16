'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import StepProgress from '@/components/StepProgress'
import { PREFLIGHT_CHECKLIST, JOB_MARKETS } from '@/lib/constants/preflight'

export default function OnboardingPage() {
  const router = useRouter()
  const [personaType, setPersonaType] = useState<'fresher' | 'experienced' | ''>('')
  const [jobMarket, setJobMarket] = useState<'IN' | 'GB' | 'GLOBAL' | ''>('')
  const [responses, setResponses] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('persona_type, job_market, preflight_responses')
        .eq('id', user.id)
        .single()

      if (profile) {
        if (profile.persona_type) setPersonaType(profile.persona_type)
        if (profile.job_market) setJobMarket(profile.job_market)
        if (profile.preflight_responses) setResponses(profile.preflight_responses as Record<string, boolean>)
      }
      setLoading(false)
    }
    load()
  }, [router])

  function toggleResponse(key: string, value: boolean) {
    setResponses((prev) => ({ ...prev, [key]: value }))
  }

  async function handleContinue() {
    if (!personaType) {
      setError('Please select whether you are a fresher or an experienced professional.')
      return
    }
    if (!jobMarket) {
      setError('Please select your target job market.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/account/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona_type: personaType,
          job_market: jobMarket,
          preflight_responses: responses,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to save.')
        return
      }

      router.push('/upload')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="max-w-2xl mx-auto px-4 py-12 text-gray-500">Loading...</div>
  }

  return (
    <div className="max-w-2xl mx-auto px-4">
      <StepProgress current={1} />

      <div className="space-y-8 pb-12">
        <div>
          <h1 className="text-xl font-semibold">What best describes you?</h1>
          <p className="text-sm text-gray-500 mt-1">
            This determines your CV structure. Choosing the right type is critical for ATS compatibility.
          </p>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <button
              onClick={() => setPersonaType('fresher')}
              className={`border rounded p-4 text-left transition shadow-sm ${personaType === 'fresher' ? 'border-blue-600 ring-1 ring-blue-600' : 'border-gray-200 hover:border-gray-400'}`}
            >
              <p className="font-medium">Fresher / Entry-level</p>
              <p className="text-xs text-gray-500 mt-1">0-2 years experience, recent graduate or career starter.</p>
            </button>
            <button
              onClick={() => setPersonaType('experienced')}
              className={`border rounded p-4 text-left transition shadow-sm ${personaType === 'experienced' ? 'border-blue-600 ring-1 ring-blue-600' : 'border-gray-200 hover:border-gray-400'}`}
            >
              <p className="font-medium">Experienced Professional</p>
              <p className="text-xs text-gray-500 mt-1">2+ years experience, professional work history.</p>
            </button>
          </div>
        </div>

        <div>
          <h2 className="font-medium">Where are you applying?</h2>
          <p className="text-sm text-gray-500 mt-1">This affects CV formatting, spelling, and terminology.</p>
          <div className="grid grid-cols-3 gap-3 mt-3">
            {JOB_MARKETS.map((market) => (
              <button
                key={market.code}
                onClick={() => setJobMarket(market.code)}
                className={`border rounded p-3 text-center text-sm transition shadow-sm ${jobMarket === market.code ? 'border-blue-600 ring-1 ring-blue-600 bg-gray-50' : 'border-gray-200 hover:border-gray-400'}`}
              >
                <span className="block font-medium">{market.code === 'GLOBAL' ? 'Global' : market.code}</span>
                <span className="block text-xs text-gray-500">{market.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="font-medium">Pre-Screening Checklist</h2>
          <p className="text-sm text-gray-500 mt-1">
            These are often the first filters employers apply — wrong answers cause instant
            auto-rejection. Your answers will be included in the CV&apos;s additional details section.
          </p>
          <div className="space-y-2 mt-3">
            {PREFLIGHT_CHECKLIST.map((item) => (
              <label key={item.key} className="flex items-start gap-3 border rounded p-3 cursor-pointer hover:border-blue-600 shadow-sm bg-white">
                <input
                  type="checkbox"
                  checked={responses[item.key] || false}
                  onChange={(e) => toggleResponse(item.key, e.target.checked)}
                  className="mt-1"
                />
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                </div>
              </label>
            ))}
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mt-3 text-xs text-yellow-800">
            <strong>Why pre-screening matters:</strong> Over 75% of applications are rejected
            before a human looks at the CV — either by ATS keyword filters or pre-screening
            questions. Getting this right puts you in the top 25% before the CV is even read.
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleContinue}
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-3 text-sm font-medium disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Continue to Your Details →'}
        </button>
      </div>
    </div>
  )
}

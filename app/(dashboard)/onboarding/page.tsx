'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function OnboardingPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function selectPersona(persona: 'fresher' | 'experienced') {
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ persona_type: persona })
      .eq('id', user.id)

    setLoading(false)

    if (error) {
      setError('Something went wrong. Please try again.')
      return
    }

    router.push('/profile')
  }

  return (
    <div className="max-w-md mx-auto mt-20 text-center space-y-6">
      <h1 className="text-2xl font-semibold">Tell us where you&apos;re starting from</h1>
      <p className="text-gray-600">This helps us tailor your resume-building experience.</p>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <div className="space-y-3">
        <button
          onClick={() => selectPersona('fresher')}
          disabled={loading}
          className="w-full border rounded-lg px-4 py-4 text-left hover:border-black transition disabled:opacity-50"
        >
          <span className="font-medium block">I&apos;m an Entry-Level Graduate / Fresher</span>
          <span className="text-sm text-gray-500">Limited or no professional experience</span>
        </button>

        <button
          onClick={() => selectPersona('experienced')}
          disabled={loading}
          className="w-full border rounded-lg px-4 py-4 text-left hover:border-black transition disabled:opacity-50"
        >
          <span className="font-medium block">I&apos;m an Experienced Professional</span>
          <span className="text-sm text-gray-500">I have prior work experience to showcase</span>
        </button>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ProfilePage() {
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function saveLocation(loc: string) {
    if (!loc.trim()) {
      setError('Please enter a location.')
      return
    }

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
      .update({ location: loc.trim() })
      .eq('id', user.id)

    setLoading(false)

    if (error) {
      setError('Something went wrong. Please try again.')
      return
    }

    router.push('/upload')
  }

  function detectBrowserLocation() {
    if (!navigator.geolocation) {
      setError('Location detection is not supported by your browser.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        // Reverse geocode via a free API (no key needed)
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}&format=json`
          )
          const data = await res.json()
          const country = data?.address?.country || ''
          if (country) {
            setLocation(country)
          } else {
            setError('Could not detect your country. Please type it manually.')
          }
        } catch {
          setError('Could not detect location. Please type it manually.')
        }
      },
      () => setError('Location permission denied. Please type your country manually.')
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    saveLocation(location)
  }

  function handleSkip() {
    router.push('/upload')
  }

  return (
    <div className="max-w-md mx-auto mt-20 space-y-6">
      <h1 className="text-2xl font-semibold">Where are you applying from?</h1>
      <p className="text-gray-600 text-sm">
        We use this to tailor formatting and pre-screening checks for your target region.
      </p>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          placeholder="e.g. India, United Kingdom, United States"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full border rounded px-3 py-2"
          maxLength={100}
        />

        <button
          type="button"
          onClick={detectBrowserLocation}
          className="w-full border rounded py-2 text-sm hover:border-black transition"
        >
          📍 Detect my location automatically
        </button>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white rounded py-2 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Continue'}
        </button>

        <button
          type="button"
          onClick={handleSkip}
          className="w-full text-sm text-gray-500 hover:text-gray-700"
        >
          Skip — I&apos;ll add my address when I upload my resume
        </button>
      </form>
    </div>
  )
}

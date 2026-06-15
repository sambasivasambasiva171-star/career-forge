'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AccountPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [personaType, setPersonaType] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setEmail(user.email || '')

      const { data: profile } = await supabase
        .from('profiles')
        .select('persona_type, location')
        .eq('id', user.id)
        .single()

      if (profile) {
        setPersonaType(profile.persona_type || '')
        setLocation(profile.location || '')
      }
      setLoading(false)
    }
    load()
  }, [router])

  async function handleSave() {
    setSaving(true)
    setSaveStatus('idle')
    setError(null)

    try {
      const res = await fetch('/api/account/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona_type: personaType, location }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to save.')
        setSaveStatus('error')
        return
      }

      setSaveStatus('saved')
    } catch {
      setError('Network error.')
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== 'DELETE') return

    setDeleting(true)
    setError(null)

    try {
      const res = await fetch('/api/account/delete', { method: 'POST' })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to delete account.')
        setDeleting(false)
        return
      }

      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
    } catch {
      setError('Network error.')
      setDeleting(false)
    }
  }

  if (loading) {
    return <div className="max-w-2xl mx-auto px-4 py-12 text-gray-500">Loading...</div>
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Account Settings</h1>
        <p className="text-sm text-gray-500 mt-1">{email}</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-4 border rounded p-6">
        <h2 className="font-medium">Profile</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Persona</label>
          <select
            value={personaType}
            onChange={(e) => setPersonaType(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="">Not set</option>
            <option value="fresher">Fresher / Entry-level</option>
            <option value="experienced">Experienced professional</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder="e.g. London, UK"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
        {saveStatus === 'saved' && <span className="text-sm text-green-600 ml-3">Saved</span>}
      </div>

      <div className="space-y-4 border border-red-200 rounded p-6 bg-red-50">
        <h2 className="font-medium text-red-900">Delete Account</h2>
        <p className="text-sm text-red-800">
          This will permanently delete your account and all associated data, including
          resumes, job descriptions, questionnaire responses, and generated documents.
          This action cannot be undone.
        </p>
        <div>
          <label className="block text-sm font-medium text-red-900 mb-1">
            Type DELETE to confirm
          </label>
          <input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            className="w-full border border-red-300 rounded px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={handleDeleteAccount}
          disabled={deleteConfirm !== 'DELETE' || deleting}
          className="bg-red-600 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
        >
          {deleting ? 'Deleting...' : 'Delete my account'}
        </button>
      </div>
    </div>
  )
}

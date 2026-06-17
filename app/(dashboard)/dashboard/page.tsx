'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import StepProgress from '@/components/StepProgress'

interface DocGroup {
  jd_id: string
  jd_snippet: string
  created_at: string
  resume_doc_id: string | null
  cover_letter_doc_id: string | null
  resume_id: string | null
}

export default function DashboardPage() {
  const router = useRouter()
  const [groups, setGroups] = useState<DocGroup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: docs } = await supabase
        .from('generated_documents')
        .select('id, doc_type, jd_id, resume_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      const { data: jds } = await supabase
        .from('job_descriptions')
        .select('id, raw_text')
        .eq('user_id', user.id)

      const jdMap = new Map((jds || []).map((jd) => [jd.id, jd.raw_text as string]))

      const groupMap = new Map<string, DocGroup>()
      for (const doc of docs || []) {
        const key = doc.jd_id as string
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            jd_id: key,
            jd_snippet: (jdMap.get(key) || '').slice(0, 120),
            created_at: doc.created_at as string,
            resume_doc_id: null,
            cover_letter_doc_id: null,
            resume_id: doc.resume_id as string | null,
          })
        }
        const group = groupMap.get(key)!
        if (doc.doc_type === 'resume') group.resume_doc_id = doc.id as string
        if (doc.doc_type === 'cover_letter') group.cover_letter_doc_id = doc.id as string
      }

      setGroups(Array.from(groupMap.values()))
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 py-12 text-gray-500">Loading...</div>
  }

  return (
    <div className="max-w-3xl mx-auto px-4">
      <StepProgress current={4} />

      <div className="space-y-6 pb-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Your Applications</h1>
            <p className="text-sm text-gray-500 mt-1">
              Resumes and cover letters you&apos;ve generated, grouped by job description.
            </p>
          </div>
          <button
            onClick={() => router.push('/onboarding')}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2 text-sm font-medium whitespace-nowrap"
          >
            + New Application
          </button>
        </div>

        {groups.length === 0 ? (
          <div className="border rounded p-8 text-center text-gray-500 text-sm">
            <p>You haven&apos;t generated any documents yet.</p>
            <button
              onClick={() => router.push('/onboarding')}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2 text-sm font-medium"
            >
              Start your first application →
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <div key={group.jd_id} className="border rounded p-4 space-y-2">
                <p className="text-xs text-gray-400">
                  {new Date(group.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
                <p className="text-sm text-gray-700">
                  {group.jd_snippet}{group.jd_snippet.length === 120 ? '...' : ''}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {group.resume_doc_id && (
                    <a
                      href={`/api/resume/pdf?document_id=${group.resume_doc_id}`}
                      className="text-sm border rounded px-3 py-1.5 hover:border-blue-600"
                    >
                      Download Resume PDF
                    </a>
                  )}
                  {group.cover_letter_doc_id && (
                    <a
                      href={`/api/cover-letter/pdf?document_id=${group.cover_letter_doc_id}`}
                      className="text-sm border rounded px-3 py-1.5 hover:border-blue-600"
                    >
                      Download Cover Letter PDF
                    </a>
                  )}
                  {group.resume_id && (
                    <button
                      onClick={() => router.push(`/review?resume_id=${group.resume_id}&jd_id=${group.jd_id}`)}
                      className="text-sm border rounded px-3 py-1.5 hover:border-blue-600"
                    >
                      Open in Review
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

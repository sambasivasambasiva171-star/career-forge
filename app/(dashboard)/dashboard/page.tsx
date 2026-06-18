'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import StepProgress from '@/components/StepProgress'
import { PreflightPanel } from '@/components/PreflightPanel'
import { PDFDownloadButton } from '@/components/PDFDownloadButton'

interface DocGroup {
  jd_id: string
  jd_snippet: string
  jd_text: string
  created_at: string
  resume_doc_id: string | null
  cover_letter_doc_id: string | null
  resume_id: string | null
  pre_screening_details: string[]
  resume_content_json: Record<string, unknown> | null
  cover_letter_text: string | null
}

interface LegacyDoc {
  id: string
  doc_type: string
  created_at: string
  content_json: Record<string, unknown> | null
}

export default function DashboardPage() {
  const router = useRouter()
  const [groups, setGroups] = useState<DocGroup[]>([])
  const [legacyDocs, setLegacyDocs] = useState<LegacyDoc[]>([])
  const [jobMarket, setJobMarket] = useState<string | null>(null)
  const [location, setLocation] = useState<string | null>(null)
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
        .select('job_market, location')
        .eq('id', user.id)
        .single()

      setJobMarket(profile?.job_market ?? null)
      setLocation(profile?.location ?? null)

      const { data: docs } = await supabase
        .from('generated_documents')
        .select('id, doc_type, jd_id, resume_id, created_at, is_legacy, content_json')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      const { data: jds } = await supabase
        .from('job_descriptions')
        .select('id, raw_text')
        .eq('user_id', user.id)

      const jdMap = new Map((jds || []).map((jd) => [jd.id, jd.raw_text as string]))

      const scopedDocs = (docs || []).filter((d) => !d.is_legacy)
      const legacy = (docs || []).filter((d) => d.is_legacy)

      const groupMap = new Map<string, DocGroup>()
      for (const doc of scopedDocs) {
        const key = doc.jd_id as string
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            jd_id: key,
            jd_snippet: (jdMap.get(key) || '').slice(0, 120),
            jd_text: jdMap.get(key) || '',
            created_at: doc.created_at as string,
            resume_doc_id: null,
            cover_letter_doc_id: null,
            resume_id: doc.resume_id as string | null,
            pre_screening_details: [],
            resume_content_json: null,
            cover_letter_text: null,
          })
        }
        const group = groupMap.get(key)!
        if (doc.doc_type === 'resume') {
          group.resume_doc_id = doc.id as string
          group.resume_content_json = doc.content_json as Record<string, unknown> | null
          group.pre_screening_details = (doc.content_json as { pre_screening_details?: string[] } | null)?.pre_screening_details || []
        }
        if (doc.doc_type === 'cover_letter') {
          group.cover_letter_doc_id = doc.id as string
          group.cover_letter_text = (doc.content_json as { cover_letter_text?: string } | null)?.cover_letter_text || null
        }
      }

      setGroups(Array.from(groupMap.values()))
      setLegacyDocs(legacy.map((d) => ({ id: d.id as string, doc_type: d.doc_type as string, created_at: d.created_at as string, content_json: d.content_json as Record<string, unknown> | null })))
      setLoading(false)
    }
    load()
  }, [router])

  async function handleDeleteApplication(documentIds: string[]) {
    if (!confirm('Delete this application? This cannot be undone.')) return

    const supabase = createClient()
    const { error } = await supabase
      .from('generated_documents')
      .delete()
      .in('id', documentIds)

    if (error) {
      alert('Failed to delete. Please try again.')
      return
    }

    // Refresh the page to reflect deletion
    window.location.reload()
  }

  async function handleDeleteAll() {
    if (!confirm(
      'Delete ALL applications? This will permanently remove every ' +
      'CV and cover letter you have generated. This cannot be undone.'
    )) return

    // Second confirmation for destructive action
    if (!confirm('Are you sure? This action is permanent.')) return

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('generated_documents')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      alert('Failed to delete. Please try again.')
      return
    }

    window.location.reload()
  }

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
          <div className="flex items-center gap-2">
            {(groups.length > 0 || legacyDocs.length > 0) && (
              <button
                onClick={handleDeleteAll}
                className="px-4 py-2 text-sm border border-red-300 text-red-500 rounded hover:bg-red-50 hover:border-red-500 transition-colors"
              >
                Delete All
              </button>
            )}
            <button
              onClick={() => router.push('/onboarding')}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2 text-sm font-medium whitespace-nowrap"
            >
              + New Application
            </button>
          </div>
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
                <div className="flex items-start justify-between">
                  <p className="text-xs text-gray-400">
                    {new Date(group.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                  <button
                    onClick={() => handleDeleteApplication([group.resume_doc_id, group.cover_letter_doc_id].filter((id): id is string => Boolean(id)))}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
                <p className="text-sm text-gray-700">
                  {group.jd_snippet}{group.jd_snippet.length === 120 ? '...' : ''}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {group.resume_doc_id && group.resume_content_json && (
                    <PDFDownloadButton
                      type="resume"
                      resumeData={group.resume_content_json}
                      filename={`Resume_${((group.resume_content_json as { contact?: { name?: string } }).contact?.name || '').replace(/\s+/g, '_') || 'document'}.pdf`}
                      label="Download Resume PDF"
                    />
                  )}
                  {group.cover_letter_doc_id && group.cover_letter_text && (
                    <PDFDownloadButton
                      type="cover-letter"
                      coverLetterText={group.cover_letter_text}
                      filename={`Cover_Letter_${((group.resume_content_json as { contact?: { name?: string } } | null)?.contact?.name || '').replace(/\s+/g, '_') || 'document'}.pdf`}
                      label="Download Cover Letter PDF"
                    />
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
                <PreflightPanel
                  jobMarket={jobMarket}
                  location={location}
                  preScreeningDetails={group.pre_screening_details}
                  jdText={group.jd_text}
                />
              </div>
            ))}
          </div>
        )}

        {legacyDocs.length > 0 && (
          <div className="mt-8 border-t pt-6">
            <h3 className="text-sm font-medium text-gray-400 mb-3">
              Earlier generations
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              These documents were generated before per-application tracking
              was enabled. They cannot be grouped by job application.
            </p>
            <div className="space-y-2">
              {legacyDocs.map((doc) => (
                <div key={doc.id} className="border rounded p-3">
                  <div className="flex justify-end">
                    <button
                      onClick={() => handleDeleteApplication([doc.id])}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-gray-400">
                        {new Date(doc.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                      <p className="text-sm text-gray-600">
                        {doc.doc_type === 'resume' ? 'Resume' : 'Cover Letter'}
                      </p>
                    </div>
                    {doc.doc_type === 'resume' ? (
                      <PDFDownloadButton
                        type="resume"
                        resumeData={doc.content_json || {}}
                        filename={`Resume_${((doc.content_json as { contact?: { name?: string } } | null)?.contact?.name || '').replace(/\s+/g, '_') || 'document'}.pdf`}
                        label="Download Resume PDF"
                      />
                    ) : (
                      <PDFDownloadButton
                        type="cover-letter"
                        coverLetterText={(doc.content_json as { cover_letter_text?: string } | null)?.cover_letter_text || ''}
                        filename="Cover_Letter.pdf"
                        label="Download Cover Letter PDF"
                      />
                    )}
                  </div>
                  <div className="mt-3 border rounded-lg p-3 bg-gray-50 text-xs text-gray-400">
                    Pre-flight audit unavailable for documents generated before
                    per-application tracking was enabled.
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

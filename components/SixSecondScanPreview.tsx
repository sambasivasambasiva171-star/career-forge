interface SixSecondScanPreviewProps {
  resume: Record<string, unknown>
}

export function SixSecondScanPreview({ resume }: SixSecondScanPreviewProps) {
  const contact = resume.contact as Record<string, unknown> | undefined
  const summary = resume.summary as string | null
  const workExperience = (resume.work_experience as Array<Record<string, unknown>>) || []

  const mostRecentRole = workExperience[0]
  const topBullets = (
    (mostRecentRole?.responsibilities as string[]) || []
  ).slice(0, 3)

  return (
    <div className="border-2 border-blue-400 rounded-lg p-6 bg-blue-50 space-y-4">
      {/* Header: Name and contact (always visible in 6 seconds) */}
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold text-gray-900">
          {(contact?.name as string) || 'Your Name'}
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          {[contact?.email, contact?.phone, contact?.location]
            .filter(Boolean)
            .join(' • ')}
        </p>
      </div>

      {/* Summary: Visible in 6 seconds (typically 2–3 lines at normal reading speed) */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
          Professional Summary
        </h2>
        <p className="text-gray-800 leading-relaxed text-sm">
          {summary || '(No summary)'}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {summary ? `${summary.split(/\s+/).length} words` : ''}
        </p>
      </div>

      {/* Most recent role: Visible in 6 seconds (title catches the eye first) */}
      {mostRecentRole && (
        <div>
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="font-semibold text-gray-900">
                {mostRecentRole.title as string}
              </h3>
              <p className="text-sm text-gray-600">
                {mostRecentRole.company as string}
                {mostRecentRole.start_date ? ` • ${mostRecentRole.start_date}` : ''}
              </p>
            </div>
          </div>

          {/* Top 2–3 bullets: Most scanning managers stop here before scrolling */}
          {topBullets.length > 0 && (
            <ul className="space-y-1 ml-4">
              {topBullets.map((bullet, i) => (
                <li key={i} className="text-sm text-gray-700 flex gap-2">
                  <span className="text-gray-400">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Dimmed section: Education, older roles, skills (typically skipped in 6 seconds) */}
      <div className="border-t pt-4 opacity-30 pointer-events-none">
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">
          [Remaining sections below the fold — typically not seen in 6 seconds]
        </p>
        <p className="text-xs text-gray-400">
          — Education, older roles, skills, certifications (visible if the hiring manager scrolls)
        </p>
      </div>

      {/* Insight footer */}
      <div className="bg-blue-50 border border-blue-300 rounded p-3 mt-4">
        <p className="text-xs text-blue-900">
          <strong>6-Second Rule:</strong> Hiring managers spend ~6 seconds scanning. They see your name, summary,
          and top role title + bullets. Everything below is invisible until they actively scroll.
          Your summary and top accomplishments must be compelling.
        </p>
      </div>
    </div>
  )
}

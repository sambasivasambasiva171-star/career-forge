import { useState, useEffect } from 'react'
import type { StrategicSkillGapResponse } from '@/lib/types/skills'

interface UseStrategicSkillGapReturn {
  data: StrategicSkillGapResponse | null
  loading: boolean
  error: string | null
}

export function useStrategicSkillGap(
  resumeId: string | null,
  jdId: string | null
): UseStrategicSkillGapReturn {
  const [data, setData] = useState<StrategicSkillGapResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!resumeId || !jdId) {
      setData(null)
      return
    }

    let cancelled = false

    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/skill-gap/strategic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resume_id: resumeId, jd_id: jdId }),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || `HTTP ${response.status}`)
        }

        if (!cancelled) setData(result)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to fetch skill gap analysis')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, [resumeId, jdId])

  return { data, loading, error }
}

'use client'

import { useEffect } from 'react'
import { usePDF } from '@react-pdf/renderer'
import { ResumeDocument } from '@/lib/pdf/ResumeDocument'
import { CoverLetterDocument } from '@/lib/pdf/CoverLetterDocument'
import { InterviewGuidanceDocument } from '@/lib/pdf/InterviewGuidanceDocument'
import type { PDFDownloadButtonProps } from './PDFDownloadButton'

type ResumeData = Parameters<typeof ResumeDocument>[0]['data']

export default function PDFDownloadButtonInner(props: PDFDownloadButtonProps) {
  const getDocument = () => {
    if (props.type === 'cover-letter' && props.coverLetterText) {
      return <CoverLetterDocument text={props.coverLetterText} />
    }
    if (props.type === 'resume' && props.resumeData) {
      return <ResumeDocument data={props.resumeData as unknown as ResumeData} />
    }
    if (props.type === 'interview-guidance' && props.guidanceData) {
      return <InterviewGuidanceDocument data={props.guidanceData} />
    }
    return null
  }

  const doc = getDocument()

  const [instance, updateInstance] = usePDF(
    doc ? { document: doc } : {}
  )

  useEffect(() => {
    const updated = getDocument()
    if (updated) updateInstance(updated)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.resumeData, props.coverLetterText, props.guidanceData])

  if (!doc) {
    return (
      <button disabled className="px-4 py-2 bg-gray-400 text-white rounded opacity-50 cursor-not-allowed">
        No document
      </button>
    )
  }

  if (instance.loading) {
    return (
      <button disabled className="px-4 py-2 bg-blue-600 text-white rounded opacity-50 cursor-not-allowed">
        Generating PDF...
      </button>
    )
  }

  if (instance.error) {
    return (
      <button disabled className="px-4 py-2 bg-red-600 text-white rounded opacity-50 cursor-not-allowed">
        PDF Error
      </button>
    )
  }

  return (
    <a
      href={instance.url!}
      download={props.filename}
      className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
    >
      {props.label || 'Download PDF'}
    </a>
  )
}

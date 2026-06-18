'use client'

import dynamic from 'next/dynamic'

const PDFDownloadButtonInner = dynamic(
  () => import('./PDFDownloadButtonInner'),
  {
    ssr: false,
    loading: () => (
      <button disabled className="px-4 py-2 bg-blue-600 text-white rounded opacity-50 cursor-not-allowed">
        Loading PDF...
      </button>
    ),
  }
)

export interface PDFDownloadButtonProps {
  type: 'resume' | 'cover-letter'
  resumeData?: Record<string, unknown>
  coverLetterText?: string
  filename: string
  label?: string
}

export function PDFDownloadButton(props: PDFDownloadButtonProps) {
  return <PDFDownloadButtonInner {...props} />
}

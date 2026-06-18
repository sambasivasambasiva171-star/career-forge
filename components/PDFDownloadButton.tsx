'use client'

import dynamic from 'next/dynamic'
import type { ResumeDocument } from '@/lib/pdf/ResumeDocument'

type ResumeData = Parameters<typeof ResumeDocument>[0]['data']

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

interface PDFDownloadButtonProps {
  resumeData: ResumeData
  filename: string
}

export function PDFDownloadButton({ resumeData, filename }: PDFDownloadButtonProps) {
  return <PDFDownloadButtonInner resumeData={resumeData} filename={filename} />
}

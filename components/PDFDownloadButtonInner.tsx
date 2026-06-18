'use client'

import { useEffect } from 'react'
import { usePDF } from '@react-pdf/renderer'
import { ResumeDocument } from '@/lib/pdf/ResumeDocument'

type ResumeData = Parameters<typeof ResumeDocument>[0]['data']

interface Props {
  resumeData: ResumeData
  filename: string
}

export default function PDFDownloadButtonInner({ resumeData, filename }: Props) {
  const [instance, updateInstance] = usePDF({ document: <ResumeDocument data={resumeData} /> })

  useEffect(() => {
    updateInstance(<ResumeDocument data={resumeData} />)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeData])

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
      download={filename}
      className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
    >
      Download PDF
    </a>
  )
}

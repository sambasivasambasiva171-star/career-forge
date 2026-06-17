import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { ResumeDocument } from '@/lib/pdf/ResumeDocument'
import { renderResumePdfSchema } from '@/lib/validation/schemas'

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = renderResumePdfSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const resumeData = parsed.data.resume_data as Parameters<typeof ResumeDocument>[0]['data']

  try {
    const pdfBuffer = await renderToBuffer(ResumeDocument({ data: resumeData }))

    const docTitle = (parsed.data.resume_data as { document_title?: string }).document_title
    const name = (parsed.data.resume_data as { contact?: { name?: string } }).contact?.name?.replace(/\s+/g, '_') || 'document'
    const filename = docTitle === 'Curriculum Vitae' ? `CV_${name}.pdf` : `Resume_${name}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('PDF rendering error:', err)
    return NextResponse.json({ error: 'Failed to generate PDF.' }, { status: 500 })
  }
}

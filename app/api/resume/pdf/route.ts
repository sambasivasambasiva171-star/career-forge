import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { ResumeDocument } from '@/lib/pdf/ResumeDocument'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const documentId = searchParams.get('document_id')

  if (!documentId) {
    return NextResponse.json({ error: 'document_id is required', code: 'INVALID_INPUT' }, { status: 400 })
  }

  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const { data: resumeDoc, error: docError } = await supabase
    .from('generated_documents')
    .select('id, content_json, user_id')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .eq('doc_type', 'resume')
    .single()

  if (docError || !resumeDoc) {
    return NextResponse.json({ error: 'No generated resume found.', code: 'NOT_FOUND' }, { status: 404 })
  }

  try {
    const pdfBuffer = await renderToBuffer(ResumeDocument({ data: resumeDoc.content_json as never }))

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${(resumeDoc.content_json as { document_title?: string }).document_title === 'Curriculum Vitae' ? 'CV' : 'Resume'}_${(resumeDoc.content_json as { contact?: { name?: string } }).contact?.name?.replace(/\s+/g, '_') || 'document'}.pdf"`,
      },
    })
  } catch (err) {
    console.error('PDF rendering error:', err)
    return NextResponse.json({ error: 'Failed to generate PDF.', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

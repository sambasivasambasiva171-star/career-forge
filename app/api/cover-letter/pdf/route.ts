import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { CoverLetterDocument } from '@/lib/pdf/CoverLetterDocument'

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

  const { data: coverLetterDoc, error: docError } = await supabase
    .from('generated_documents')
    .select('id, content_json, user_id')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .eq('doc_type', 'cover_letter')
    .single()

  if (docError || !coverLetterDoc) {
    return NextResponse.json({ error: 'No generated cover letter found.', code: 'NOT_FOUND' }, { status: 404 })
  }

  const content = coverLetterDoc.content_json as { cover_letter_text?: string }

  if (!content.cover_letter_text) {
    return NextResponse.json({ error: 'Cover letter content is empty.', code: 'NOT_FOUND' }, { status: 404 })
  }

  try {
    const pdfBuffer = await renderToBuffer(CoverLetterDocument({ text: content.cover_letter_text }))

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="cover_letter.pdf"',
      },
    })
  } catch (err) {
    console.error('Cover letter PDF rendering error:', err)
    return NextResponse.json({ error: 'Failed to generate PDF.', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

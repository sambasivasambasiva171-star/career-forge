import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { CoverLetterDocument } from '@/lib/pdf/CoverLetterDocument'

export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: latestCoverLetter, error: docError } = await supabase
    .from('generated_documents')
    .select('id, content_json, user_id')
    .eq('user_id', user.id)
    .eq('doc_type', 'cover_letter')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (docError || !latestCoverLetter) {
    return NextResponse.json({ error: 'No generated cover letter found.' }, { status: 404 })
  }

  const content = latestCoverLetter.content_json as { cover_letter_text?: string }

  if (!content.cover_letter_text) {
    return NextResponse.json({ error: 'Cover letter content is empty.' }, { status: 404 })
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
    return NextResponse.json({ error: 'Failed to generate PDF.' }, { status: 500 })
  }
}

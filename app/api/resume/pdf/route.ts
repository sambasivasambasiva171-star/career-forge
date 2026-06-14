import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { ResumeDocument } from '@/lib/pdf/ResumeDocument'

export async function GET(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: latestResume, error: docError } = await supabase
    .from('generated_documents')
    .select('id, content_json, user_id')
    .eq('user_id', user.id)
    .eq('doc_type', 'resume')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (docError || !latestResume) {
    return NextResponse.json({ error: 'No generated resume found.' }, { status: 404 })
  }

  try {
    const pdfBuffer = await renderToBuffer(ResumeDocument({ data: latestResume.content_json as never }))

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="resume.pdf"',
      },
    })
  } catch (err) {
    console.error('PDF rendering error:', err)
    return NextResponse.json({ error: 'Failed to generate PDF.' }, { status: 500 })
  }
}

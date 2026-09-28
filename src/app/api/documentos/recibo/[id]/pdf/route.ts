import { NextResponse } from 'next/server';
import { NotFoundError } from '@/server/auth/errors';
import { buildReceiptDocument, loadLogo } from '@/server/documents/model';
import { pdfResponse, guardApi } from '@/server/documents/http';
import { renderReceiptPdf } from '@/server/documents/pdf/documents';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await guardApi('documents.print', 'payments.view');
  if ('response' in guard) return guard.response;

  const { id } = await context.params;
  const paymentId = Number(id);
  if (!Number.isInteger(paymentId)) return NextResponse.json({ error: 'Pagamento inválido' }, { status: 400 });

  try {
    const doc = await buildReceiptDocument(paymentId);
    const pdf = await renderReceiptPdf(doc, await loadLogo(doc.company));
    return pdfResponse(pdf, `${doc.code}.pdf`, new URL(request.url).searchParams.get('download') === '1');
  } catch (error) {
    if (error instanceof NotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    throw error;
  }
}

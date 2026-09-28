import { NextResponse } from 'next/server';
import { NotFoundError } from '@/server/auth/errors';
import { buildSaleDocument, loadLogo } from '@/server/documents/model';
import { pdfResponse, guardApi } from '@/server/documents/http';
import { renderSalePdf } from '@/server/documents/pdf/documents';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const guard = await guardApi('documents.print', 'sales.view');
  if ('response' in guard) return guard.response;

  const { id } = await context.params;
  const saleId = Number(id);
  if (!Number.isInteger(saleId)) return NextResponse.json({ error: 'Venda inválida' }, { status: 400 });

  try {
    const doc = await buildSaleDocument(saleId);
    const pdf = await renderSalePdf(doc, await loadLogo(doc.company));
    return pdfResponse(pdf, `${doc.code}.pdf`, new URL(request.url).searchParams.get('download') === '1');
  } catch (error) {
    if (error instanceof NotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    throw error;
  }
}

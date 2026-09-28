import { NextResponse } from 'next/server';
import { NotFoundError } from '@/server/auth/errors';
import { buildOrderDocument, buildReceiptDocument, buildSaleDocument, loadLogo } from '@/server/documents/model';
import { pdfResponse } from '@/server/documents/http';
import { renderOrderPdf, renderReceiptPdf, renderSalePdf } from '@/server/documents/pdf/documents';
import { resolveShareToken } from '@/server/services/document-links';

/**
 * Link público de compartilhamento: quem tem o endereço (token de 256 bits, gerado pelo sistema e revogável)
 * baixa o PDF daquele documento. Nenhuma outra informação do sistema é exposta.
 */
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const link = await resolveShareToken(token);
  if (!link) return new NextResponse('Link inválido, expirado ou revogado.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex' } });

  try {
    if (link.type === 'ORDER') {
      const doc = await buildOrderDocument(link.refId);
      return pdfResponse(await renderOrderPdf(doc, await loadLogo(doc.company)), `${doc.code}.pdf`, false);
    }
    if (link.type === 'SALE') {
      const doc = await buildSaleDocument(link.refId);
      return pdfResponse(await renderSalePdf(doc, await loadLogo(doc.company)), `${doc.code}.pdf`, false);
    }
    const doc = await buildReceiptDocument(link.refId);
    return pdfResponse(await renderReceiptPdf(doc, await loadLogo(doc.company)), `${doc.code}.pdf`, false);
  } catch (error) {
    if (error instanceof NotFoundError) return new NextResponse('Documento não encontrado.', { status: 404 });
    throw error;
  }
}

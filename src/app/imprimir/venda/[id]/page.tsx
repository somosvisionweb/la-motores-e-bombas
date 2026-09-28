import { notFound } from 'next/navigation';
import { DocToolbar } from '@/components/documents/DocToolbar';
import { SaleSheet } from '@/components/documents/OrderSheets';
import { buildSaleDocument } from '@/server/documents/model';
import { requirePagePermission } from '@/server/auth/session';
import { NotFoundError } from '@/server/auth/errors';
import { firstParam, type SearchParams } from '@/lib/query';

export const metadata = { title: 'Imprimir comprovante de venda' };

export default async function PrintSalePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  await requirePagePermission('documents.print', 'sales.view');
  const { id } = await params;
  const query = await searchParams;
  const saleId = Number(id);
  if (!Number.isInteger(saleId)) notFound();

  let doc;
  try {
    doc = await buildSaleDocument(saleId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <>
      <DocToolbar title={`${doc.title} ${doc.code}`} backHref={`/sistema/vendas/${saleId}`} pdfHref={`/api/documentos/venda/${saleId}/pdf?download=1`} autoPrint={firstParam(query.auto) === '1'} />
      <SaleSheet doc={doc} />
    </>
  );
}

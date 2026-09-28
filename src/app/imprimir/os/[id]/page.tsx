import { notFound } from 'next/navigation';
import { DocToolbar } from '@/components/documents/DocToolbar';
import { OrderSheets } from '@/components/documents/OrderSheets';
import { buildOrderDocument } from '@/server/documents/model';
import { requirePagePermission } from '@/server/auth/session';
import { NotFoundError } from '@/server/auth/errors';
import { firstParam, type SearchParams } from '@/lib/query';

export const metadata = { title: 'Imprimir ordem de serviço' };

export default async function PrintOrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  await requirePagePermission('documents.print', 'orders.view');
  const { id } = await params;
  const query = await searchParams;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) notFound();

  let doc;
  try {
    doc = await buildOrderDocument(orderId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <>
      <DocToolbar title={`${doc.title} ${doc.code}`} backHref={`/sistema/ordens/${orderId}`} pdfHref={`/api/documentos/os/${orderId}/pdf?download=1`} autoPrint={firstParam(query.auto) === '1'} />
      <OrderSheets doc={doc} />
    </>
  );
}

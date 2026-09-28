import { notFound } from 'next/navigation';
import { DocToolbar } from '@/components/documents/DocToolbar';
import { ReceiptSheet } from '@/components/documents/OrderSheets';
import { buildReceiptDocument } from '@/server/documents/model';
import { requirePagePermission } from '@/server/auth/session';
import { NotFoundError } from '@/server/auth/errors';
import { firstParam, type SearchParams } from '@/lib/query';

export const metadata = { title: 'Imprimir recibo' };

export default async function PrintReceiptPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  await requirePagePermission('documents.print', 'payments.view');
  const { id } = await params;
  const query = await searchParams;
  const paymentId = Number(id);
  if (!Number.isInteger(paymentId)) notFound();

  let doc;
  try {
    doc = await buildReceiptDocument(paymentId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <>
      <DocToolbar title={`${doc.title} ${doc.code}`} backHref="/sistema/impressao" pdfHref={`/api/documentos/recibo/${paymentId}/pdf?download=1`} autoPrint={firstParam(query.auto) === '1'} />
      <ReceiptSheet doc={doc} />
    </>
  );
}

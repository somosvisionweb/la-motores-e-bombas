import { StorePrintStation } from '@/components/documents/StorePrintStation';
import { requirePagePermission } from '@/server/auth/session';
import { latestStoreOrderId } from '@/server/services/store-orders';

export const metadata = { title: 'Impressão automática dos pedidos da loja' };

/** Página que fica aberta no computador da loja e imprime (A4) cada pedido novo do site assim que ele chega. */
export default async function StorePrintStationPage() {
  await requirePagePermission('store.view', 'documents.print');
  return <StorePrintStation latestOrderId={await latestStoreOrderId()} />;
}

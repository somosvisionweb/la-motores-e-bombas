import { NextResponse } from 'next/server';
import { guardApi } from '@/server/documents/http';
import { buildSaleDocument } from '@/server/documents/model';
import { latestStoreOrderToPrint, listStoreOrdersToPrint } from '@/server/services/store-orders';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Pedidos da loja com o documento A4 pronto, para a "estação de impressão" (`/imprimir/loja`), que imprime cada
 * pedido assim que ele chega:
 *  - `?depois=<id>`: os pedidos criados depois desse id (até 5, do mais antigo para o mais novo);
 *  - `?ultimo=1`: só o pedido mais recente que não foi cancelado (teste da impressora).
 * Só quem pode ver os pedidos da loja e imprimir documentos.
 */
export async function GET(request: Request) {
  const guard = await guardApi('store.view', 'documents.print');
  if ('response' in guard) return guard.response;

  const params = new URL(request.url).searchParams;

  if (params.get('ultimo') === '1') {
    const latest = await latestStoreOrderToPrint();
    const orders = latest ? [{ ...latest, doc: await buildSaleDocument(latest.saleId) }] : [];
    return NextResponse.json({ upTo: latest?.id ?? 0, orders }, { headers: NO_STORE });
  }

  const raw = params.get('depois');
  const after = raw === null || raw.trim() === '' ? NaN : Number(raw);
  if (!Number.isSafeInteger(after) || after < 0) return NextResponse.json({ error: 'Parâmetro "depois" inválido.' }, { status: 400 });

  const { upTo, orders } = await listStoreOrdersToPrint(after, 5);
  const withDocuments = await Promise.all(orders.map(async (order) => ({ ...order, doc: await buildSaleDocument(order.saleId) })));
  return NextResponse.json({ upTo, orders: withDocuments }, { headers: NO_STORE });
}

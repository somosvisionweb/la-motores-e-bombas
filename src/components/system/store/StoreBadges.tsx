import { Badge } from '@/components/ui/Badge';
import { STORE_ORDER_STATUS, type StoreOrderStatus } from '@/config/store';
import { STORE_LISTING_STATUS, type StoreListingStatus } from '@/lib/store-pricing';

export function StoreStatusBadge({ status }: { status: StoreOrderStatus }) {
  const meta = STORE_ORDER_STATUS[status];
  return (
    <Badge tone={meta.tone} dot title={meta.hint}>
      {meta.label}
    </Badge>
  );
}

/** Situação do produto na loja (à venda, sem preço, sem estoque, só consulta, oculto). */
export function StoreListingBadge({ status }: { status: StoreListingStatus }) {
  const meta = STORE_LISTING_STATUS[status];
  return (
    <Badge tone={meta.tone} dot title={meta.hint}>
      {meta.label}
    </Badge>
  );
}

/** Origem da venda: pedidos feitos no site aparecem com este selo em Vendas. */
export function ChannelBadge({ channel }: { channel: 'BALCAO' | 'LOJA' }) {
  if (channel !== 'LOJA') return null;
  return (
    <Badge tone="blue" title="Pedido feito na loja virtual do site">
      Loja online
    </Badge>
  );
}

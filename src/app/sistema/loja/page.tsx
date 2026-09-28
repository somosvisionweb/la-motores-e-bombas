import Link from 'next/link';
import { ExternalLink, Plus, Printer, Store } from 'lucide-react';
import { StoreAdminTabs } from '@/components/system/store/StoreAdminTabs';
import { StoreStatusBadge } from '@/components/system/store/StoreBadges';
import { DemoBadge, PaymentStateBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Money } from '@/components/ui/Money';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { StatCard } from '@/components/ui/StatCard';
import { FilterBar, FilterSelect, SearchField } from '@/components/system/FilterBar';
import { FULFILLMENT_LABEL, STORE_ORDER_STATUS, storePaymentLabel } from '@/config/store';
import { formatStoreOrderCode } from '@/lib/codes';
import { formatDateTimeBR, startOfMonthISO, todayISO, zonedDayBoundMs } from '@/lib/dates';
import { param, parsePage, type SearchParams } from '@/lib/query';
import { displayPhone } from '@/lib/phone';
import { requirePagePermission } from '@/server/auth/session';
import { hasPermission } from '@/server/auth/types';
import { getCompanySettings } from '@/server/services/settings';
import { expireStaleStoreOrders, listStoreOrders, STORE_ORDER_FILTERS, storeOrdersSummary, type StoreOrderFilter } from '@/server/services/store-orders';

export const metadata = { title: 'Loja online' };

const FILTER_LABEL: Record<(typeof STORE_ORDER_FILTERS)[number], string> = {
  ABERTOS: 'Em andamento',
  PAGAMENTO: 'Aguardando pagamento (PIX)',
  RECEIVED: STORE_ORDER_STATUS.RECEIVED.label,
  CONFIRMED: STORE_ORDER_STATUS.CONFIRMED.label,
  READY: STORE_ORDER_STATUS.READY.label,
  OUT_FOR_DELIVERY: STORE_ORDER_STATUS.OUT_FOR_DELIVERY.label,
  COMPLETED: STORE_ORDER_STATUS.COMPLETED.label,
  CANCELED: STORE_ORDER_STATUS.CANCELED.label,
};

export default async function StoreOrdersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission('store.view');
  const params = await searchParams;
  const company = await getCompanySettings();
  const q = param(params, 'q');
  const requested = param(params, 'status') as StoreOrderFilter;
  const filter = (STORE_ORDER_FILTERS as readonly string[]).includes(requested) ? requested : undefined;
  const page = parsePage(params);

  await expireStaleStoreOrders();
  const monthStart = zonedDayBoundMs(startOfMonthISO(todayISO(company.timezone)), company.timezone, 'start');
  const [{ rows, total }, summary] = await Promise.all([listStoreOrders({ q, filter, page }), storeOrdersSummary(monthStart)]);
  const basePath = '/sistema/loja';
  const canSeeSales = hasPermission(user, 'sales.view');

  return (
    <>
      <PageHeader
        title="Loja online"
        subtitle="Pedidos feitos pelo site. Confirme, separe e conclua — estoque e financeiro acompanham automaticamente."
        actions={
          <>
            <Link href="/loja" target="_blank" className="btn">
              <ExternalLink aria-hidden="true" /> Ver a loja
            </Link>
            {hasPermission(user, 'documents.print') ? (
              <Link href="/imprimir/loja" target="_blank" className="btn" title="Abre uma página que imprime cada pedido novo do site em uma folha A4 assim que ele chega">
                <Printer aria-hidden="true" /> Impressão automática
              </Link>
            ) : null}
            {hasPermission(user, 'products.manage') ? (
              <Link href="/sistema/loja/produtos" className="btn btn--primary">
                <Plus aria-hidden="true" /> Adicionar item à loja
              </Link>
            ) : null}
          </>
        }
      />
      <StoreAdminTabs active="pedidos" canSeeCatalog={hasPermission(user, 'products.view')} canSeeSettings={hasPermission(user, 'settings.manage')} />
      <div className="stack" style={{ ['--gap' as string]: '16px' }}>
        <div className="grid grid--4">
          <StatCard label="Pedidos novos" value={summary.received} meta="Aguardando confirmação" icon={<Store />} accent={summary.received > 0 ? 'green' : 'navy'} />
          <StatCard label="Aguardando pagamento" value={summary.awaitingPayment} meta="PIX ainda não confirmado" accent="navy" />
          <StatCard label="Prontos / em entrega" value={summary.ready} meta="Esperando retirada ou entrega" accent="navy" />
          {canSeeSales ? <StatCard label="Vendido no mês" value={<Money cents={summary.soldMonthCents} />} meta={`${summary.ordersMonth} ${summary.ordersMonth === 1 ? 'pedido' : 'pedidos'} (sem cancelados)`} accent="green" /> : null}
        </div>

        <Card>
          <FilterBar clearHref={basePath} hasFilters={Boolean(q || filter)}>
            <SearchField defaultValue={q} placeholder="LJ-000012, nome ou telefone…" />
            <FilterSelect name="status" label="Situação" defaultValue={filter} allLabel="Todas" options={STORE_ORDER_FILTERS.map((key) => ({ value: key, label: FILTER_LABEL[key] }))} />
          </FilterBar>
          {rows.length === 0 ? (
            <EmptyState icon={<Store size={26} aria-hidden="true" />} title={q || filter ? 'Nenhum pedido com esse filtro' : 'Nenhum pedido ainda'}>
              {q || filter ? 'Ajuste a busca ou a situação.' : 'Quando um cliente finalizar uma compra no site, o pedido aparece aqui e você recebe um aviso.'}
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table table--stack">
                <thead>
                  <tr>
                    <th scope="col">Pedido</th>
                    <th scope="col">Recebido em</th>
                    <th scope="col">Cliente</th>
                    <th scope="col" className="col-hide-md">
                      Recebimento
                    </th>
                    <th scope="col">Pagamento</th>
                    <th scope="col" className="num">
                      Total
                    </th>
                    <th scope="col">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((order) => (
                    <tr key={order.id} style={order.status === 'CANCELED' ? { opacity: 0.6 } : undefined}>
                      <td className="cell-primary" data-label="">
                        <Link href={`${basePath}/${order.id}`} className="code-tag">
                          {formatStoreOrderCode(order.number)}
                        </Link>{' '}
                        {order.isDemo ? <DemoBadge /> : null}
                      </td>
                      <td data-label="Recebido em" className="nowrap text-muted">
                        {formatDateTimeBR(order.createdAt, company.timezone)}
                      </td>
                      <td data-label="Cliente">
                        {order.buyerName}
                        <span className="cell-sub">{displayPhone(order.buyerPhone)}</span>
                      </td>
                      <td data-label="Recebimento" className="col-hide-md">
                        {FULFILLMENT_LABEL[order.fulfillment]}
                        <span className="cell-sub">{order.itemsCount} {order.itemsCount === 1 ? 'item' : 'itens'}</span>
                      </td>
                      <td data-label="Pagamento">
                        {storePaymentLabel(order.paymentMethod, order.fulfillment)}
                        <span className="cell-sub">{order.status === 'CANCELED' ? '—' : <PaymentStateBadge total={order.totalCents} paid={order.paidCents} />}</span>
                      </td>
                      <td className="num" data-label="Total">
                        <Money cents={order.totalCents} />
                      </td>
                      <td data-label="Situação">
                        <StoreStatusBadge status={order.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} total={total} basePath={basePath} params={params} noun="pedidos" />
        </Card>
      </div>
    </>
  );
}

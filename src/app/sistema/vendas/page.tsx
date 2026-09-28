import Link from 'next/link';
import { Plus, ShoppingCart } from 'lucide-react';
import { ChannelBadge } from '@/components/system/store/StoreBadges';
import { Badge, DemoBadge, PaymentStateBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Money } from '@/components/ui/Money';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { PeriodFilter } from '@/components/ui/PeriodFilter';
import { SortHeader } from '@/components/ui/SortHeader';
import { StatCard } from '@/components/ui/StatCard';
import { FilterBar, FilterSelect, SearchField } from '@/components/system/FilterBar';
import { formatSaleCode } from '@/lib/codes';
import { formatDateBR, resolvePeriod, todayISO } from '@/lib/dates';
import { param, parsePage, parseSort, type SearchParams } from '@/lib/query';
import { requirePagePermission } from '@/server/auth/session';
import { hasPermission } from '@/server/auth/types';
import { listSales, SALE_SORT_KEYS } from '@/server/services/sales';
import { getCompanySettings } from '@/server/services/settings';

export const metadata = { title: 'Vendas' };

export default async function SalesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission('sales.view');
  const params = await searchParams;
  const company = await getCompanySettings();
  const period = resolvePeriod(param(params, 'periodo') || 'mes', todayISO(company.timezone), { from: param(params, 'de'), to: param(params, 'ate') });
  const q = param(params, 'q');
  const status = param(params, 'status') as 'ACTIVE' | 'CANCELED' | '';
  const channel = param(params, 'canal') as 'BALCAO' | 'LOJA' | '';
  const page = parsePage(params);
  const sort = parseSort(params, SALE_SORT_KEYS, { key: 'date', dir: 'desc' });
  const { rows, total, soldTotalCents } = await listSales({ q, from: period.from, to: period.to, status: status || undefined, channel: channel || undefined, sort: sort.key, dir: sort.dir, page });
  const basePath = '/sistema/vendas';
  const canSeePayments = hasPermission(user, 'payments.view');

  return (
    <>
      <PageHeader
        title="Vendas"
        subtitle="Venda de produtos e componentes no balcão."
        actions={
          hasPermission(user, 'sales.create') ? (
            <Link href={`${basePath}/nova`} className="btn btn--primary">
              <Plus aria-hidden="true" /> Nova venda
            </Link>
          ) : null
        }
      />
      <div className="stack" style={{ ['--gap' as string]: '16px' }}>
        <PeriodFilter basePath={basePath} params={params} period={period} />
        <div className="grid grid--3">
          <StatCard label="Total vendido no período" value={<Money cents={soldTotalCents} />} meta={period.label} icon={<ShoppingCart />} accent="green" />
          <StatCard label="Vendas registradas" value={total} meta="Inclui canceladas quando filtradas" accent="navy" />
        </div>

        <Card>
          <FilterBar clearHref={`${basePath}?periodo=${period.key}${period.key === 'personalizado' ? `&de=${period.from}&ate=${period.to}` : ''}`} hasFilters={Boolean(q || status || channel)} keep={{ periodo: period.key, de: param(params, 'de'), ate: param(params, 'ate') }}>
            <SearchField defaultValue={q} placeholder="VD-000045, cliente…" />
            <FilterSelect name="status" label="Situação" defaultValue={status} options={[{ value: 'ACTIVE', label: 'Ativas' }, { value: 'CANCELED', label: 'Canceladas' }]} />
            <FilterSelect name="canal" label="Canal" defaultValue={channel} options={[{ value: 'BALCAO', label: 'Balcão' }, { value: 'LOJA', label: 'Loja online' }]} />
          </FilterBar>
          {rows.length === 0 ? (
            <EmptyState icon={<ShoppingCart size={26} aria-hidden="true" />} title="Nenhuma venda no período">
              Ajuste o período ou registre uma nova venda.
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table table--stack">
                <thead>
                  <tr>
                    <SortHeader label="Venda" sortKey="number" current={sort} basePath={basePath} params={params} />
                    <SortHeader label="Data" sortKey="date" current={sort} basePath={basePath} params={params} />
                    <SortHeader label="Cliente" sortKey="customer" current={sort} basePath={basePath} params={params} />
                    <th scope="col" className="num">
                      Itens
                    </th>
                    <SortHeader label="Total" sortKey="total" current={sort} basePath={basePath} params={params} numeric />
                    {canSeePayments ? <th scope="col">Pagamento</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id} style={s.status === 'CANCELED' ? { opacity: 0.6 } : undefined}>
                      <td className="cell-primary" data-label="">
                        <Link href={`${basePath}/${s.id}`} className="code-tag">
                          {formatSaleCode(s.number)}
                        </Link>{' '}
                        {s.isDemo ? <DemoBadge /> : null} <ChannelBadge channel={s.channel} /> {s.status === 'CANCELED' ? <Badge tone="red">Cancelada</Badge> : null}
                      </td>
                      <td data-label="Data" className="nowrap text-muted">
                        {formatDateBR(s.saleDate)}
                      </td>
                      <td data-label="Cliente">{s.customerName ?? s.storeBuyerName ?? <span className="text-subtle">Consumidor final</span>}</td>
                      <td className="num" data-label="Itens">
                        {s.itemsCount}
                      </td>
                      <td className="num" data-label="Total">
                        <Money cents={s.totalCents} />
                      </td>
                      {canSeePayments ? (
                        <td data-label="Pagamento">{s.status === 'CANCELED' ? <span className="text-subtle">—</span> : <PaymentStateBadge total={s.totalCents} paid={s.paidCents} />}</td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} total={total} basePath={basePath} params={params} noun="vendas" />
        </Card>
      </div>
    </>
  );
}

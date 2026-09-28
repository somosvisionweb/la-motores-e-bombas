import Link from 'next/link';
import { Plus, Wallet } from 'lucide-react';
import { voidPaymentAction } from '@/actions/orders';
import { FinanceTabs } from '@/components/system/finance/FinanceTabs';
import { FilterBar, FilterSelect, SearchField } from '@/components/system/FilterBar';
import { Badge, DemoBadge, MethodBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ConfirmActionForm } from '@/components/ui/ConfirmActionForm';
import { EmptyState } from '@/components/ui/EmptyState';
import { Money } from '@/components/ui/Money';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { PeriodFilter } from '@/components/ui/PeriodFilter';
import { SortHeader } from '@/components/ui/SortHeader';
import { StatCard } from '@/components/ui/StatCard';
import { isPaymentMethod, PAYMENT_METHOD_KEYS, PAYMENT_METHOD_SHORT } from '@/config/payment-methods';
import { formatOrderCode, formatSaleCode } from '@/lib/codes';
import { formatDateBR, resolvePeriod, todayISO } from '@/lib/dates';
import { formatBRL } from '@/lib/money';
import { param, parsePage, parseSort, type SearchParams } from '@/lib/query';
import { requirePagePermission } from '@/server/auth/session';
import { hasPermission } from '@/server/auth/types';
import { listPayments, PAYMENT_SORT_KEYS } from '@/server/services/payments';
import { getCompanySettings } from '@/server/services/settings';

export const metadata = { title: 'Entradas' };

export default async function IncomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission('payments.view');
  const params = await searchParams;
  const company = await getCompanySettings();
  const period = resolvePeriod(param(params, 'periodo') || 'mes', todayISO(company.timezone), { from: param(params, 'de'), to: param(params, 'ate') });
  const q = param(params, 'q');
  const methodParam = param(params, 'forma');
  const method = isPaymentMethod(methodParam) ? methodParam : undefined;
  const includeVoided = param(params, 'estornados') === '1';
  const page = parsePage(params);
  const sort = parseSort(params, PAYMENT_SORT_KEYS, { key: 'date', dir: 'desc' });
  const { rows, total, paidTotalCents, byMethod } = await listPayments({ from: period.from, to: period.to, method, q, includeVoided, sort: sort.key, dir: sort.dir, page });
  const basePath = '/sistema/financeiro/entradas';
  const keep = { periodo: period.key, de: param(params, 'de'), ate: param(params, 'ate'), ordem: param(params, 'ordem'), dir: param(params, 'dir') };

  return (
    <>
      <PageHeader
        title="Entradas"
        subtitle="Todos os pagamentos recebidos (ordens de serviço, vendas e entradas avulsas)."
        actions={
          hasPermission(user, 'payments.create') ? (
            <Link href={`${basePath}/nova`} className="btn btn--primary">
              <Plus aria-hidden="true" /> Nova entrada avulsa
            </Link>
          ) : null
        }
      />
      <FinanceTabs active="income" canOverview={hasPermission(user, 'finance.view')} canIncome canExpense={hasPermission(user, 'expenses.view')} />

      <div className="stack" style={{ ['--gap' as string]: '16px' }}>
        <PeriodFilter basePath={basePath} params={params} period={period} />
        <div className="grid grid--5">
          <StatCard label="Total recebido" value={<Money cents={paidTotalCents} />} meta={period.short} icon={<Wallet />} accent="green" />
          {PAYMENT_METHOD_KEYS.map((key) => (
            <StatCard key={key} label={PAYMENT_METHOD_SHORT[key]} value={<Money cents={byMethod[key] ?? 0} />} accent="navy" />
          ))}
        </div>

        <Card>
          <FilterBar clearHref={`${basePath}?periodo=${period.key}`} hasFilters={Boolean(q || method || includeVoided)} keep={keep}>
            <SearchField defaultValue={q} placeholder="Cliente, descrição, OS-000123…" />
            <FilterSelect name="forma" label="Forma" defaultValue={method} options={PAYMENT_METHOD_KEYS.map((k) => ({ value: k, label: PAYMENT_METHOD_SHORT[k] }))} />
            <FilterSelect name="estornados" label="Estornados" defaultValue={includeVoided ? '1' : ''} options={[{ value: '1', label: 'Mostrar' }]} allLabel="Ocultar" />
          </FilterBar>
          {rows.length === 0 ? (
            <EmptyState icon={<Wallet size={26} aria-hidden="true" />} title="Nenhuma entrada no período">
              Ajuste o período ou os filtros.
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table table--stack">
                <thead>
                  <tr>
                    <SortHeader label="Data" sortKey="date" current={sort} basePath={basePath} params={params} />
                    <th scope="col">Cliente</th>
                    <th scope="col">Referência</th>
                    <SortHeader label="Forma" sortKey="method" current={sort} basePath={basePath} params={params} />
                    <SortHeader label="Valor" sortKey="amount" current={sort} basePath={basePath} params={params} numeric />
                    <th scope="col" className="actions" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} style={p.status === 'VOIDED' ? { opacity: 0.55 } : undefined}>
                      <td data-label="Data" className="nowrap">
                        {formatDateBR(p.paidDate)}
                      </td>
                      <td className="cell-primary" data-label="">
                        {p.customerName ?? <span className="text-subtle">Sem cliente</span>} {p.isDemo ? <DemoBadge /> : null}
                      </td>
                      <td data-label="Referência">
                        {p.orderId && p.orderNumber ? (
                          <Link href={`/sistema/ordens/${p.orderId}`} className="code-tag">
                            {formatOrderCode(p.orderNumber)}
                          </Link>
                        ) : p.saleId && p.saleNumber ? (
                          <Link href={`/sistema/vendas/${p.saleId}`} className="code-tag">
                            {formatSaleCode(p.saleNumber)}
                          </Link>
                        ) : (
                          <span>{p.description}</span>
                        )}
                        {p.status === 'VOIDED' ? (
                          <>
                            {' '}
                            <Badge tone="red">Estornado</Badge>
                            <span className="cell-sub">{p.voidReason}</span>
                          </>
                        ) : p.orderId || p.saleId ? (
                          <span className="cell-sub">{p.description}</span>
                        ) : null}
                      </td>
                      <td data-label="Forma">
                        <MethodBadge method={p.method} />
                      </td>
                      <td className="num" data-label="Valor">
                        <Money cents={p.amountCents} tone={p.status === 'VOIDED' ? 'muted' : 'positive'} />
                      </td>
                      <td className="actions" data-label="">
                        <span className="cluster" style={{ gap: 6, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                          {p.status === 'PAID' && hasPermission(user, 'documents.print') ? (
                            <Link href={`/imprimir/recibo/${p.id}`} className="btn btn--sm">
                              Recibo
                            </Link>
                          ) : null}
                          {p.status === 'PAID' && hasPermission(user, 'payments.void') ? (
                            <ConfirmActionForm
                              action={voidPaymentAction}
                              fields={{ id: p.id }}
                              title="Estornar pagamento?"
                              message={`O valor de ${formatBRL(p.amountCents)} deixará de contar nas entradas. O registro permanece como estornado.`}
                              confirmLabel="Estornar"
                              triggerLabel="Estornar"
                              reasonLabel="Motivo do estorno"
                              reasonRequired
                            />
                          ) : null}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} total={total} basePath={basePath} params={params} noun="pagamentos" />
        </Card>
      </div>
    </>
  );
}

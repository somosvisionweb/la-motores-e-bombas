import Link from 'next/link';
import { FileDown, FileText, Printer, Receipt } from 'lucide-react';
import { FilterBar, SearchField } from '@/components/system/FilterBar';
import { MethodBadge, StatusBadge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Money } from '@/components/ui/Money';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatOrderCode, formatSaleCode } from '@/lib/codes';
import { formatDateBR, todayISO } from '@/lib/dates';
import { param, type SearchParams } from '@/lib/query';
import { requirePagePermission } from '@/server/auth/session';
import { hasPermission } from '@/server/auth/types';
import { listOrders } from '@/server/services/orders';
import { listPayments } from '@/server/services/payments';
import { REPORT_META, REPORT_TYPES } from '@/server/services/reports';
import { listSales } from '@/server/services/sales';
import { getCompanySettings } from '@/server/services/settings';

export const metadata = { title: 'Impressão' };

export default async function PrintCenterPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission('documents.print');
  const params = await searchParams;
  const q = param(params, 'q');
  const company = await getCompanySettings();
  const today = todayISO(company.timezone);
  const canOrders = hasPermission(user, 'orders.view');
  const canPayments = hasPermission(user, 'payments.view');
  const canSales = hasPermission(user, 'sales.view');
  const canReports = hasPermission(user, 'reports.export');

  const [orders, payments, sales] = await Promise.all([
    canOrders ? listOrders({ q, today, pageSize: 8, sort: 'number', dir: 'desc' }) : Promise.resolve({ rows: [], total: 0 }),
    canPayments ? listPayments({ q, pageSize: 8, sort: 'date', dir: 'desc' }) : Promise.resolve({ rows: [], total: 0 }),
    canSales ? listSales({ q, pageSize: 8, sort: 'date', dir: 'desc' }) : Promise.resolve({ rows: [], total: 0 }),
  ]);

  return (
    <>
      <PageHeader title="Impressão" subtitle="Imprima em folha A4 ou gere PDF de ordens de serviço, recibos, comprovantes e relatórios." />
      <div className="stack" style={{ ['--gap' as string]: '20px' }}>
        <Card>
          <FilterBar clearHref="/sistema/impressao" hasFilters={Boolean(q)}>
            <SearchField defaultValue={q} placeholder="OS-000123, cliente, telefone…" label="Localizar documento" />
          </FilterBar>
        </Card>

        {canOrders ? (
          <Card>
            <CardHeader title="Ordens de serviço" subtitle={q ? 'Resultado da busca' : 'Mais recentes'} icon={<FileText size={20} color="var(--navy-500)" aria-hidden="true" />} />
            {orders.rows.length === 0 ? (
              <EmptyState title="Nenhuma ordem encontrada" />
            ) : (
              <div className="table-wrap">
                <table className="table table--stack table--compact">
                  <tbody>
                    {orders.rows.map((o) => (
                      <tr key={o.id}>
                        <td className="cell-primary" data-label="">
                          <Link href={`/sistema/ordens/${o.id}`} className="code-tag">
                            {formatOrderCode(o.number)}
                          </Link>
                        </td>
                        <td data-label="Cliente">
                          {o.customerName}
                          <span className="cell-sub">{o.equipment}</span>
                        </td>
                        <td data-label="Status">
                          <StatusBadge status={o.status} />
                        </td>
                        <td className="num" data-label="Total">
                          <Money cents={o.totalCents} />
                        </td>
                        <td className="actions" data-label="">
                          <span className="cluster" style={{ gap: 6, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                            <Link href={`/imprimir/os/${o.id}`} className="btn btn--sm">
                              <Printer aria-hidden="true" /> Imprimir
                            </Link>
                            <a href={`/api/documentos/os/${o.id}/pdf?download=1`} className="btn btn--sm">
                              <FileDown aria-hidden="true" /> PDF
                            </a>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ) : null}

        {canPayments ? (
          <Card>
            <CardHeader title="Recibos de pagamento" subtitle={q ? 'Resultado da busca' : 'Pagamentos mais recentes'} icon={<Receipt size={20} color="var(--green-700)" aria-hidden="true" />} />
            {payments.rows.length === 0 ? (
              <EmptyState title="Nenhum pagamento encontrado" />
            ) : (
              <div className="table-wrap">
                <table className="table table--stack table--compact">
                  <tbody>
                    {payments.rows.map((p) => (
                      <tr key={p.id}>
                        <td className="nowrap" data-label="Data">
                          {formatDateBR(p.paidDate)}
                        </td>
                        <td className="cell-primary" data-label="">
                          {p.customerName ?? 'Sem cliente'}
                          <span className="cell-sub">{p.orderNumber ? formatOrderCode(p.orderNumber) : p.saleNumber ? formatSaleCode(p.saleNumber) : p.description}</span>
                        </td>
                        <td data-label="Forma">
                          <MethodBadge method={p.method} />
                        </td>
                        <td className="num" data-label="Valor">
                          <Money cents={p.amountCents} tone="positive" />
                        </td>
                        <td className="actions" data-label="">
                          <span className="cluster" style={{ gap: 6, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                            <Link href={`/imprimir/recibo/${p.id}`} className="btn btn--sm">
                              <Printer aria-hidden="true" /> Imprimir
                            </Link>
                            <a href={`/api/documentos/recibo/${p.id}/pdf?download=1`} className="btn btn--sm">
                              <FileDown aria-hidden="true" /> PDF
                            </a>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ) : null}

        {canSales ? (
          <Card>
            <CardHeader title="Comprovantes de venda" subtitle={q ? 'Resultado da busca' : 'Vendas mais recentes'} />
            {sales.rows.length === 0 ? (
              <EmptyState title="Nenhuma venda encontrada" />
            ) : (
              <div className="table-wrap">
                <table className="table table--stack table--compact">
                  <tbody>
                    {sales.rows.map((s) => (
                      <tr key={s.id}>
                        <td className="cell-primary" data-label="">
                          <Link href={`/sistema/vendas/${s.id}`} className="code-tag">
                            {formatSaleCode(s.number)}
                          </Link>
                        </td>
                        <td data-label="Cliente">
                          {s.customerName ?? 'Consumidor final'}
                          <span className="cell-sub">{formatDateBR(s.saleDate)}</span>
                        </td>
                        <td className="num" data-label="Total">
                          <Money cents={s.totalCents} />
                        </td>
                        <td className="actions" data-label="">
                          <span className="cluster" style={{ gap: 6, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                            <Link href={`/imprimir/venda/${s.id}`} className="btn btn--sm">
                              <Printer aria-hidden="true" /> Imprimir
                            </Link>
                            <a href={`/api/documentos/venda/${s.id}/pdf?download=1`} className="btn btn--sm">
                              <FileDown aria-hidden="true" /> PDF
                            </a>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ) : null}

        {canReports ? (
          <Card>
            <CardHeader title="Relatórios" subtitle="Últimos 30 dias — para outro período, abra o relatório e escolha o intervalo." />
            <div className="table-wrap">
              <table className="table table--stack table--compact">
                <tbody>
                  {REPORT_TYPES.filter((t) => hasPermission(user, REPORT_META[t].permission)).map((t) => (
                    <tr key={t}>
                      <td className="cell-primary" data-label="">
                        {REPORT_META[t].title}
                        <span className="cell-sub">{REPORT_META[t].description}</span>
                      </td>
                      <td className="actions" data-label="">
                        <span className="cluster" style={{ gap: 6, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                          <Link href={`/imprimir/relatorio/${t}?periodo=30d`} className="btn btn--sm">
                            <Printer aria-hidden="true" /> Imprimir
                          </Link>
                          <a href={`/api/documentos/relatorio/${t}/pdf?periodo=30d&download=1`} className="btn btn--sm">
                            <FileDown aria-hidden="true" /> PDF
                          </a>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}
      </div>
    </>
  );
}

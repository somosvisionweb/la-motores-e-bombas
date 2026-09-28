import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, ArrowUpRight, Boxes, ClipboardCheck, ClipboardList, PackagePlus, Plus, ShoppingCart, TrendingUp, UserPlus, Users, Wallet, Wrench } from 'lucide-react';
import { ColumnChart } from '@/components/charts/ColumnChart';
import { HBarChart } from '@/components/charts/HBarChart';
import { formatCompactBRL } from '@/components/charts/scale';
import { DemoBadge, MethodBadge, StatusBadge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Money } from '@/components/ui/Money';
import { PageHeader } from '@/components/ui/PageHeader';
import { PeriodFilter } from '@/components/ui/PeriodFilter';
import { StatCard } from '@/components/ui/StatCard';
import { firstAllowedHref } from '@/config/navigation';
import { PAYMENT_METHOD_SHORT } from '@/config/payment-methods';
import { formatOrderCode, formatSaleCode } from '@/lib/codes';
import { formatDateBR, formatLongDateWithWeekdayBR, resolvePeriod, todayISO } from '@/lib/dates';
import { formatBRL, formatInt } from '@/lib/money';
import { param, type SearchParams } from '@/lib/query';
import { requireUser } from '@/server/auth/session';
import { hasPermission } from '@/server/auth/types';
import { getDashboardData } from '@/server/services/dashboard';
import { getSystemAlerts } from '@/server/services/notifications';
import { getCompanySettings } from '@/server/services/settings';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  if (!hasPermission(user, 'dashboard.view')) redirect(firstAllowedHref(user.permissions));

  const params = await searchParams;
  const company = await getCompanySettings();
  const today = todayISO(company.timezone);
  const period = resolvePeriod(param(params, 'periodo') || '30d', today, { from: param(params, 'de'), to: param(params, 'ate') });
  const canFinance = hasPermission(user, 'finance.view');

  const [data, alerts] = await Promise.all([
    getDashboardData(period, { finance: canFinance, timezone: company.timezone }),
    getSystemAlerts(user, company.timezone),
  ]);
  const { finance } = data;

  const shortcuts = [
    { href: '/sistema/ordens/nova', label: 'Nova OS', icon: <ClipboardList aria-hidden="true" />, allowed: hasPermission(user, 'orders.create') },
    { href: '/sistema/clientes/novo', label: 'Novo cliente', icon: <UserPlus aria-hidden="true" />, allowed: hasPermission(user, 'customers.create') },
    { href: '/sistema/vendas/nova', label: 'Nova venda', icon: <ShoppingCart aria-hidden="true" />, allowed: hasPermission(user, 'sales.create') },
    { href: '/sistema/produtos/novo', label: 'Novo produto', icon: <PackagePlus aria-hidden="true" />, allowed: hasPermission(user, 'products.manage') },
  ].filter((s) => s.allowed);

  return (
    <>
      <PageHeader title={`Olá, ${user.name.split(' ')[0]}`} subtitle={<span className="first-upper">{formatLongDateWithWeekdayBR(today)}</span>} />

      {shortcuts.length > 0 ? (
        <nav className="shortcuts" aria-label="Atalhos rápidos">
          {shortcuts.map((s) => (
            <Link key={s.href} href={s.href} className="shortcut">
              <span className="shortcut__icon">{s.icon}</span>
              <span className="shortcut__label">{s.label}</span>
              <Plus className="shortcut__plus" aria-hidden="true" />
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="stack" style={{ ['--gap' as string]: '20px', marginTop: 20 }}>
        <PeriodFilter basePath="/sistema" params={params} period={period} />

        <div className="kpi-grid">
          {finance ? (
            <>
              <StatCard label="Entradas" value={<Money cents={finance.summary.incomeCents} />} meta={`${formatInt(finance.summary.paymentsCount)} pagamento(s) · ${period.short}`} icon={<Wallet />} accent="green" />
              <StatCard label="Custo de mercadorias" value={<Money cents={finance.summary.goodsCents} />} meta={`de ${formatBRL(finance.summary.expenseCents)} em custos totais`} icon={<Boxes />} accent="navy" />
              <StatCard
                label="Resultado"
                value={<Money cents={finance.summary.resultCents} />}
                valueTone={finance.summary.resultCents < 0 ? 'negative' : 'positive'}
                meta="Entradas − custos cadastrados"
                icon={<TrendingUp />}
                accent={finance.summary.resultCents < 0 ? 'red' : 'green'}
              />
            </>
          ) : null}
          <StatCard label="Serviços realizados" value={formatInt(data.services.completedCount)} meta={`Concluídos · ${period.short}`} icon={<ClipboardCheck />} accent="green" />
          <StatCard label="Ordens abertas" value={formatInt(data.openOrders)} meta="Em andamento agora" icon={<Wrench />} accent="navy" />
          <StatCard label="Clientes" value={formatInt(data.customersTotal)} meta={`+${formatInt(data.newCustomers)} no período`} icon={<Users />} accent="navy" />
        </div>

        {alerts.length > 0 ? (
          <Card>
            <CardHeader title="Alertas" subtitle="Pontos que pedem atenção agora" icon={<AlertTriangle size={20} color="var(--color-warning)" aria-hidden="true" />} />
            <CardBody flush>
              <ul className="alert-list">
                {alerts.map((a) => (
                  <li key={a.key}>
                    <Link href={a.link} className={`alert-item alert-item--${a.tone}`}>
                      <span className="alert-item__count">{a.count}</span>
                      <span className="grow">
                        <strong>{a.title}</strong>
                        <span className="alert-item__body">{a.body}</span>
                      </span>
                      <ArrowUpRight size={18} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}

        {finance ? (
          <div className="dash-grid">
            <Card>
              <CardHeader title="Entradas por período" subtitle={`${period.label} · valores recebidos`} />
              <CardBody>
                <ColumnChart
                  categories={data.axis.labels}
                  fullLabels={data.axis.fullLabels}
                  series={[{ key: 'income', label: 'Entradas', color: 'green', values: finance.incomeSeries }]}
                  formatValue={formatBRL}
                  formatAxis={formatCompactBRL}
                  ariaLabel="Entradas por período"
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Serviços realizados" subtitle="Ordens concluídas por período" />
              <CardBody>
                <ColumnChart
                  categories={data.axis.labels}
                  fullLabels={data.axis.fullLabels}
                  series={[{ key: 'services', label: 'Serviços', color: 'navy', values: data.services.completedSeries }]}
                  formatValue={(v) => `${formatInt(v)} ${v === 1 ? 'serviço' : 'serviços'}`}
                  integer
                  ariaLabel="Serviços realizados por período"
                  emptyText="Nenhum serviço concluído neste período."
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Formas de pagamento" subtitle="Quanto entrou em cada forma" />
              <CardBody>
                <HBarChart
                  rows={finance.byMethod.map((m) => ({ label: PAYMENT_METHOD_SHORT[m.method], value: m.cents, sub: `${formatInt(m.count)} pagamento(s)` }))}
                  formatValue={formatBRL}
                  color="green"
                  ariaLabel="Entradas por forma de pagamento"
                  valueHeader="Recebido"
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Produtos vendidos" subtitle="Vendas e peças usadas em ordens" />
              <CardBody>
                <HBarChart
                  rows={data.topProducts.map((p) => ({ label: p.name, value: p.quantity, sub: formatBRL(p.cents) }))}
                  formatValue={(v) => `${formatInt(v)} un.`}
                  showShare={false}
                  ariaLabel="Produtos mais vendidos"
                  valueHeader="Quantidade"
                  emptyText="Nenhum produto vendido neste período."
                />
              </CardBody>
            </Card>
            <Card className="dash-grid__wide">
              <CardHeader title="Movimentação financeira" subtitle="Entradas e custos no período" />
              <CardBody>
                <ColumnChart
                  categories={data.axis.labels}
                  fullLabels={data.axis.fullLabels}
                  series={[
                    { key: 'income', label: 'Entradas', color: 'green', values: finance.incomeSeries },
                    { key: 'expense', label: 'Custos', color: 'navy', values: finance.expenseSeries },
                  ]}
                  formatValue={formatBRL}
                  formatAxis={formatCompactBRL}
                  ariaLabel="Movimentação financeira: entradas e custos"
                />
              </CardBody>
            </Card>
          </div>
        ) : (
          <div className="dash-grid">
            <Card>
              <CardHeader title="Serviços realizados" subtitle="Ordens concluídas por período" />
              <CardBody>
                <ColumnChart
                  categories={data.axis.labels}
                  fullLabels={data.axis.fullLabels}
                  series={[{ key: 'services', label: 'Serviços', color: 'navy', values: data.services.completedSeries }]}
                  formatValue={(v) => `${formatInt(v)} ${v === 1 ? 'serviço' : 'serviços'}`}
                  integer
                  ariaLabel="Serviços realizados por período"
                  emptyText="Nenhum serviço concluído neste período."
                />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Produtos vendidos" subtitle="Vendas e peças usadas em ordens" />
              <CardBody>
                <HBarChart
                  rows={data.topProducts.map((p) => ({ label: p.name, value: p.quantity }))}
                  formatValue={(v) => `${formatInt(v)} un.`}
                  showShare={false}
                  ariaLabel="Produtos mais vendidos"
                  valueHeader="Quantidade"
                  emptyText="Nenhum produto vendido neste período."
                />
              </CardBody>
            </Card>
          </div>
        )}

        <div className="dash-grid dash-grid--tables">
          <Card>
            <CardHeader
              title="Serviços em andamento"
              actions={
                <Link href="/sistema/ordens?status=abertas" className="btn btn--sm btn--ghost">
                  Ver todas
                </Link>
              }
            />
            {data.inProgress.length === 0 ? (
              <EmptyState icon={<Wrench size={22} aria-hidden="true" />} title="Nenhuma ordem em andamento" />
            ) : (
              <div className="table-wrap">
                <table className="table table--stack table--compact">
                  <thead>
                    <tr>
                      <th scope="col">OS</th>
                      <th scope="col">Cliente</th>
                      <th scope="col">Previsão</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.inProgress.map((o) => (
                      <tr key={o.id}>
                        <td className="cell-primary" data-label="">
                          <Link href={`/sistema/ordens/${o.id}`} className="code-tag">
                            {formatOrderCode(o.number)}
                          </Link>{' '}
                          {o.isDemo ? <DemoBadge /> : null}
                        </td>
                        <td data-label="Cliente">
                          {o.customerName}
                          <span className="cell-sub">{o.equipment}</span>
                        </td>
                        <td data-label="Previsão" className="nowrap">
                          {o.expectedDeliveryDate ? formatDateBR(o.expectedDeliveryDate) : '—'}
                        </td>
                        <td data-label="Status">
                          <StatusBadge status={o.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Ordens recentes"
              actions={
                <Link href="/sistema/ordens" className="btn btn--sm btn--ghost">
                  Ver todas
                </Link>
              }
            />
            {data.recentOrders.length === 0 ? (
              <EmptyState icon={<ClipboardList size={22} aria-hidden="true" />} title="Nenhuma ordem criada ainda" />
            ) : (
              <div className="table-wrap">
                <table className="table table--stack table--compact">
                  <thead>
                    <tr>
                      <th scope="col">OS</th>
                      <th scope="col">Cliente</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="num">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentOrders.map((o) => (
                      <tr key={o.id}>
                        <td className="cell-primary" data-label="">
                          <Link href={`/sistema/ordens/${o.id}`} className="code-tag">
                            {formatOrderCode(o.number)}
                          </Link>{' '}
                          {o.isDemo ? <DemoBadge /> : null}
                        </td>
                        <td data-label="Cliente">
                          {o.customerName}
                          <span className="cell-sub">{formatDateBR(o.entryDate)}</span>
                        </td>
                        <td data-label="Status">
                          <StatusBadge status={o.status} />
                        </td>
                        <td className="num" data-label="Total">
                          <Money cents={o.totalCents} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {finance ? (
            <Card className="dash-grid__wide">
              <CardHeader
                title="Últimos pagamentos"
                actions={
                  <Link href="/sistema/financeiro/entradas" className="btn btn--sm btn--ghost">
                    Ver entradas
                  </Link>
                }
              />
              {finance.latestPayments.length === 0 ? (
                <EmptyState icon={<Wallet size={22} aria-hidden="true" />} title="Nenhum pagamento registrado" />
              ) : (
                <div className="table-wrap">
                  <table className="table table--stack table--compact">
                    <thead>
                      <tr>
                        <th scope="col">Data</th>
                        <th scope="col">Cliente / referência</th>
                        <th scope="col">Forma</th>
                        <th scope="col" className="num">
                          Valor
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {finance.latestPayments.map((p) => (
                        <tr key={p.id}>
                          <td data-label="Data" className="nowrap">
                            {formatDateBR(p.paidDate)}
                          </td>
                          <td className="cell-primary" data-label="">
                            {p.customerName ?? 'Consumidor final'} {p.isDemo ? <DemoBadge /> : null}
                            <span className="cell-sub">
                              {p.orderId && p.orderNumber ? formatOrderCode(p.orderNumber) : p.saleId && p.saleNumber ? formatSaleCode(p.saleNumber) : p.description}
                            </span>
                          </td>
                          <td data-label="Forma">
                            <MethodBadge method={p.method} />
                          </td>
                          <td className="num" data-label="Valor">
                            <Money cents={p.amountCents} tone="positive" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

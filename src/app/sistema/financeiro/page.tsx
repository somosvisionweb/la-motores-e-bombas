import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Boxes, Receipt, TrendingUp, Wallet } from 'lucide-react';
import { ColumnChart } from '@/components/charts/ColumnChart';
import { HBarChart } from '@/components/charts/HBarChart';
import { formatCompactBRL } from '@/components/charts/scale';
import { FinanceTabs } from '@/components/system/finance/FinanceTabs';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Money } from '@/components/ui/Money';
import { PageHeader } from '@/components/ui/PageHeader';
import { PeriodFilter } from '@/components/ui/PeriodFilter';
import { StatCard } from '@/components/ui/StatCard';
import { PAYMENT_METHOD_SHORT } from '@/config/payment-methods';
import { resolvePeriod, todayISO } from '@/lib/dates';
import { formatBRL, formatInt } from '@/lib/money';
import { param, type SearchParams } from '@/lib/query';
import { requireUser } from '@/server/auth/session';
import { hasPermission } from '@/server/auth/types';
import { getExpenseByCategory, getExpenseSeries, getFinanceSummary, getIncomeByMethod, getIncomeSeries } from '@/server/services/finance';
import { aggregateSeries, buildAxis } from '@/server/services/series';
import { getCompanySettings } from '@/server/services/settings';

export const metadata = { title: 'Financeiro' };

export default async function FinancePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const canOverview = hasPermission(user, 'finance.view');
  const canIncome = hasPermission(user, 'payments.view');
  const canExpense = hasPermission(user, 'expenses.view');
  if (!canOverview) redirect(canIncome ? '/sistema/financeiro/entradas' : canExpense ? '/sistema/financeiro/custos' : '/sistema/acesso-negado');

  const params = await searchParams;
  const company = await getCompanySettings();
  const period = resolvePeriod(param(params, 'periodo') || 'mes', todayISO(company.timezone), { from: param(params, 'de'), to: param(params, 'ate') });
  const axis = buildAxis(period.from, period.to, period.days);
  const [summary, income, expense, byMethod, byCategory] = await Promise.all([
    getFinanceSummary(period.from, period.to),
    getIncomeSeries(period.from, period.to),
    getExpenseSeries(period.from, period.to),
    getIncomeByMethod(period.from, period.to),
    getExpenseByCategory(period.from, period.to),
  ]);

  return (
    <>
      <PageHeader
        title="Financeiro"
        subtitle="Entradas, custos e resultado da empresa."
        actions={
          <>
            {hasPermission(user, 'payments.create') ? (
              <Link href="/sistema/financeiro/entradas/nova" className="btn btn--primary">
                <Wallet aria-hidden="true" /> Nova entrada
              </Link>
            ) : null}
            {hasPermission(user, 'expenses.manage') ? (
              <Link href="/sistema/financeiro/custos/novo" className="btn">
                <Receipt aria-hidden="true" /> Novo custo
              </Link>
            ) : null}
          </>
        }
      />
      <FinanceTabs active="overview" canOverview canIncome={canIncome} canExpense={canExpense} />

      <div className="stack" style={{ ['--gap' as string]: '20px' }}>
        <PeriodFilter basePath="/sistema/financeiro" params={params} period={period} />
        <div className="kpi-grid">
          <StatCard label="Entradas" value={<Money cents={summary.incomeCents} />} meta={`${formatInt(summary.paymentsCount)} pagamento(s) · ${period.short}`} icon={<Wallet />} accent="green" />
          <StatCard label="Custos" value={<Money cents={summary.expenseCents} />} meta={`${formatInt(summary.expensesCount)} lançamento(s) · ${formatBRL(summary.goodsCents)} em mercadorias`} icon={<Boxes />} accent="navy" />
          <StatCard
            label="Resultado"
            value={<Money cents={summary.resultCents} />}
            valueTone={summary.resultCents < 0 ? 'negative' : 'positive'}
            meta="Entradas − custos cadastrados"
            icon={<TrendingUp />}
            accent={summary.resultCents < 0 ? 'red' : 'green'}
          />
        </div>

        <Card>
          <CardHeader title="Entradas × custos" subtitle={period.label} />
          <CardBody>
            <ColumnChart
              categories={axis.labels}
              fullLabels={axis.fullLabels}
              series={[
                { key: 'income', label: 'Entradas', color: 'green', values: aggregateSeries(income.map((p) => ({ date: p.date, value: p.cents })), axis) },
                { key: 'expense', label: 'Custos', color: 'navy', values: aggregateSeries(expense.map((p) => ({ date: p.date, value: p.cents })), axis) },
              ]}
              formatValue={formatBRL}
              formatAxis={formatCompactBRL}
              ariaLabel="Entradas e custos no período"
            />
          </CardBody>
        </Card>

        <div className="dash-grid">
          <Card>
            <CardHeader title="Entradas por forma de pagamento" />
            <CardBody>
              <HBarChart
                rows={[...byMethod].sort((a, b) => b.cents - a.cents).map((m) => ({ label: PAYMENT_METHOD_SHORT[m.method], value: m.cents, sub: `${formatInt(m.count)} pagamento(s)` }))}
                formatValue={formatBRL}
                color="green"
                ariaLabel="Entradas por forma de pagamento"
                valueHeader="Recebido"
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Custos por categoria" />
            <CardBody>
              <HBarChart
                rows={byCategory.map((c) => ({ label: c.name, value: c.cents, sub: `${formatInt(c.count)} lançamento(s)` }))}
                formatValue={formatBRL}
                ariaLabel="Custos por categoria"
                valueHeader="Custo"
                emptyText="Nenhum custo lançado neste período."
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

import Link from 'next/link';
import { Pencil, Plus, Receipt } from 'lucide-react';
import { FinanceTabs } from '@/components/system/finance/FinanceTabs';
import { FilterBar, FilterSelect, SearchField } from '@/components/system/FilterBar';
import { DemoBadge, MethodBadge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Money } from '@/components/ui/Money';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { PeriodFilter } from '@/components/ui/PeriodFilter';
import { SortHeader } from '@/components/ui/SortHeader';
import { StatCard } from '@/components/ui/StatCard';
import { formatDateBR, resolvePeriod, todayISO } from '@/lib/dates';
import { param, parsePage, parseSort, type SearchParams } from '@/lib/query';
import { requirePagePermission } from '@/server/auth/session';
import { hasPermission } from '@/server/auth/types';
import { EXPENSE_SORT_KEYS, listExpenseCategories, listExpenses } from '@/server/services/expenses';
import { getCompanySettings } from '@/server/services/settings';

export const metadata = { title: 'Custos' };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission('expenses.view');
  const params = await searchParams;
  const company = await getCompanySettings();
  const period = resolvePeriod(param(params, 'periodo') || 'mes', todayISO(company.timezone), { from: param(params, 'de'), to: param(params, 'ate') });
  const q = param(params, 'q');
  const categoryId = Number(param(params, 'categoria')) || undefined;
  const page = parsePage(params);
  const sort = parseSort(params, EXPENSE_SORT_KEYS, { key: 'date', dir: 'desc' });
  const canManage = hasPermission(user, 'expenses.manage');
  const [{ rows, total, totalCents }, categories] = await Promise.all([
    listExpenses({ from: period.from, to: period.to, categoryId, q, sort: sort.key, dir: sort.dir, page }),
    listExpenseCategories(),
  ]);
  const basePath = '/sistema/financeiro/custos';

  return (
    <>
      <PageHeader
        title="Custos"
        subtitle="Compras de mercadorias, despesas e demais saídas."
        actions={
          canManage ? (
            <Link href={`${basePath}/novo`} className="btn btn--primary">
              <Plus aria-hidden="true" /> Novo custo
            </Link>
          ) : null
        }
      />
      <FinanceTabs active="expenses" canOverview={hasPermission(user, 'finance.view')} canIncome={hasPermission(user, 'payments.view')} canExpense />

      <div className="stack" style={{ ['--gap' as string]: '16px' }}>
        <PeriodFilter basePath={basePath} params={params} period={period} />
        <div className="grid grid--3">
          <StatCard label="Total de custos" value={<Money cents={totalCents} />} meta={`${total} lançamento(s) · ${period.short}`} icon={<Receipt />} accent="navy" />
        </div>
        <Card>
          <FilterBar clearHref={`${basePath}?periodo=${period.key}`} hasFilters={Boolean(q || categoryId)} keep={{ periodo: period.key, de: param(params, 'de'), ate: param(params, 'ate'), ordem: param(params, 'ordem'), dir: param(params, 'dir') }}>
            <SearchField defaultValue={q} placeholder="Descrição ou fornecedor…" />
            <FilterSelect name="categoria" label="Categoria" defaultValue={categoryId ? String(categoryId) : ''} options={categories.map((c) => ({ value: String(c.id), label: c.name }))} />
          </FilterBar>
          {rows.length === 0 ? (
            <EmptyState icon={<Receipt size={26} aria-hidden="true" />} title="Nenhum custo no período">
              Ajuste o período ou lance um novo custo.
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table table--stack">
                <thead>
                  <tr>
                    <SortHeader label="Data" sortKey="date" current={sort} basePath={basePath} params={params} />
                    <th scope="col">Descrição</th>
                    <SortHeader label="Categoria" sortKey="category" current={sort} basePath={basePath} params={params} />
                    <th scope="col">Forma</th>
                    <SortHeader label="Valor" sortKey="amount" current={sort} basePath={basePath} params={params} numeric />
                    {canManage ? <th scope="col" className="actions" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id}>
                      <td data-label="Data" className="nowrap">
                        {formatDateBR(e.date)}
                      </td>
                      <td className="cell-primary" data-label="">
                        {e.description} {e.isDemo ? <DemoBadge /> : null}
                        {e.supplier ? <span className="cell-sub">{e.supplier}</span> : null}
                      </td>
                      <td data-label="Categoria">
                        {e.categoryName}
                      </td>
                      <td data-label="Forma">
                        <MethodBadge method={e.paymentMethod} />
                      </td>
                      <td className="num" data-label="Valor">
                        <Money cents={e.amountCents} />
                      </td>
                      {canManage ? (
                        <td className="actions" data-label="">
                          <Link href={`${basePath}/${e.id}`} className="btn btn--sm btn--icon" aria-label={`Editar ${e.description}`} title="Editar">
                            <Pencil aria-hidden="true" />
                          </Link>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} total={total} basePath={basePath} params={params} noun="custos" />
        </Card>
      </div>
    </>
  );
}

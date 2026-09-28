import { Trash2 } from 'lucide-react';
import { deleteExpenseCategoryAction } from '@/actions/finance';
import { ExpenseCategoryDialog } from '@/components/system/finance/FinanceForms';
import { FinanceTabs } from '@/components/system/finance/FinanceTabs';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ConfirmActionForm } from '@/components/ui/ConfirmActionForm';
import { PageHeader } from '@/components/ui/PageHeader';
import { requirePagePermission } from '@/server/auth/session';
import { hasPermission } from '@/server/auth/types';
import { listExpenseCategories } from '@/server/services/expenses';

export const metadata = { title: 'Categorias de custo' };

export default async function ExpenseCategoriesPage() {
  const user = await requirePagePermission('expenses.view');
  const categories = await listExpenseCategories();
  const canManage = hasPermission(user, 'expenses.manage');

  return (
    <>
      <PageHeader title="Categorias de custo" subtitle="Organize os custos. Categorias marcadas como “mercadorias” alimentam o card “Custo de mercadorias”." actions={canManage ? <ExpenseCategoryDialog /> : null} />
      <FinanceTabs active="categories" canOverview={hasPermission(user, 'finance.view')} canIncome={hasPermission(user, 'payments.view')} canExpense />
      <Card>
        <div className="table-wrap">
          <table className="table table--stack">
            <thead>
              <tr>
                <th scope="col">Categoria</th>
                <th scope="col">Tipo</th>
                <th scope="col" className="num">
                  Lançamentos
                </th>
                {canManage ? <th scope="col" className="actions" /> : null}
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <tr key={c.id}>
                  <td className="cell-primary" data-label="">
                    {c.name}
                  </td>
                  <td data-label="Tipo">{c.isGoods ? <Badge tone="teal">Mercadorias</Badge> : <span className="text-muted">Despesa</span>}</td>
                  <td className="num" data-label="Lançamentos">
                    {c.usage}
                  </td>
                  {canManage ? (
                    <td className="actions" data-label="">
                      <span className="cluster" style={{ gap: 6, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                        <ExpenseCategoryDialog category={{ id: c.id, name: c.name, isGoods: c.isGoods }} />
                        <ConfirmActionForm
                          action={deleteExpenseCategoryAction}
                          fields={{ id: c.id }}
                          title="Excluir categoria?"
                          message={`A categoria “${c.name}” será removida. Só é possível excluir categorias sem custos lançados.`}
                          confirmLabel="Excluir"
                          triggerLabel={`Excluir ${c.name}`}
                          triggerIcon={<Trash2 aria-hidden="true" />}
                          iconOnly
                        />
                      </span>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

import { notFound } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { deleteExpenseAction, updateExpenseAction } from '@/actions/finance';
import { ExpenseForm } from '@/components/system/finance/FinanceForms';
import { Card, CardBody } from '@/components/ui/Card';
import { ConfirmActionForm } from '@/components/ui/ConfirmActionForm';
import { PageHeader } from '@/components/ui/PageHeader';
import { isPaymentMethod, type PaymentMethod } from '@/config/payment-methods';
import { todayISO } from '@/lib/dates';
import { requirePagePermission } from '@/server/auth/session';
import { getExpense, listExpenseCategories, listSuppliers } from '@/server/services/expenses';
import { getCompanySettings } from '@/server/services/settings';

export const metadata = { title: 'Editar custo' };

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission('expenses.manage');
  const { id } = await params;
  const expense = Number.isInteger(Number(id)) ? await getExpense(Number(id)) : null;
  if (!expense) notFound();
  const [company, categories, suppliers] = await Promise.all([getCompanySettings(), listExpenseCategories({ activeOnly: true }), listSuppliers()]);

  return (
    <div className="page--narrow" style={{ marginInline: 'auto' }}>
      <PageHeader
        title="Editar custo"
        crumbs={[{ label: 'Financeiro', href: '/sistema/financeiro/custos' }, { label: expense.description }]}
        actions={
          <ConfirmActionForm
            action={deleteExpenseAction}
            fields={{ id: expense.id }}
            title="Excluir custo?"
            message={`O lançamento “${expense.description}” será removido do financeiro. Esta ação não pode ser desfeita.`}
            confirmLabel="Excluir custo"
            triggerLabel="Excluir"
            triggerIcon={<Trash2 aria-hidden="true" />}
            triggerSize="md"
          />
        }
      />
      <Card>
        <CardBody>
          <ExpenseForm
            action={updateExpenseAction}
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
            suppliers={suppliers}
            methods={company.paymentMethods.filter(isPaymentMethod) as PaymentMethod[]}
            today={todayISO(company.timezone)}
            expense={expense}
          />
        </CardBody>
      </Card>
    </div>
  );
}

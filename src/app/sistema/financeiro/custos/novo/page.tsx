import { createExpenseAction } from '@/actions/finance';
import { ExpenseForm } from '@/components/system/finance/FinanceForms';
import { Card, CardBody } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { isPaymentMethod, type PaymentMethod } from '@/config/payment-methods';
import { todayISO } from '@/lib/dates';
import { requirePagePermission } from '@/server/auth/session';
import { listExpenseCategories, listSuppliers } from '@/server/services/expenses';
import { getCompanySettings } from '@/server/services/settings';

export const metadata = { title: 'Novo custo' };

export default async function NewExpensePage() {
  await requirePagePermission('expenses.manage');
  const [company, categories, suppliers] = await Promise.all([getCompanySettings(), listExpenseCategories({ activeOnly: true }), listSuppliers()]);
  return (
    <div className="page--narrow" style={{ marginInline: 'auto' }}>
      <PageHeader title="Novo custo" crumbs={[{ label: 'Financeiro', href: '/sistema/financeiro/custos' }, { label: 'Novo custo' }]} />
      <Card>
        <CardBody>
          <ExpenseForm
            action={createExpenseAction}
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
            suppliers={suppliers}
            methods={company.paymentMethods.filter(isPaymentMethod) as PaymentMethod[]}
            today={todayISO(company.timezone)}
          />
        </CardBody>
      </Card>
    </div>
  );
}

import { createStandalonePaymentAction } from '@/actions/finance';
import { StandalonePaymentForm } from '@/components/system/finance/FinanceForms';
import { Card, CardBody } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { isPaymentMethod, type PaymentMethod } from '@/config/payment-methods';
import { todayISO } from '@/lib/dates';
import { requirePagePermission } from '@/server/auth/session';
import { hasPermission } from '@/server/auth/types';
import { getCompanySettings } from '@/server/services/settings';

export const metadata = { title: 'Nova entrada' };

export default async function NewIncomePage() {
  const user = await requirePagePermission('payments.create');
  const company = await getCompanySettings();
  return (
    <div className="page--narrow" style={{ marginInline: 'auto' }}>
      <PageHeader title="Nova entrada avulsa" crumbs={[{ label: 'Financeiro', href: '/sistema/financeiro/entradas' }, { label: 'Nova entrada' }]} />
      <Card>
        <CardBody>
          <StandalonePaymentForm
            action={createStandalonePaymentAction}
            today={todayISO(company.timezone)}
            methods={company.paymentMethods.filter(isPaymentMethod) as PaymentMethod[]}
            canPickCustomer={hasPermission(user, 'customers.view')}
            canCreateCustomer={hasPermission(user, 'customers.create')}
          />
        </CardBody>
      </Card>
    </div>
  );
}

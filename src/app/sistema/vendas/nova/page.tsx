import { createSaleAction } from '@/actions/sales';
import { SaleForm } from '@/components/system/sales/SaleForm';
import { PageHeader } from '@/components/ui/PageHeader';
import { isPaymentMethod, type PaymentMethod } from '@/config/payment-methods';
import { todayISO } from '@/lib/dates';
import { param, type SearchParams } from '@/lib/query';
import { requirePagePermission } from '@/server/auth/session';
import { hasPermission } from '@/server/auth/types';
import { getCustomer } from '@/server/services/customers';
import { getCompanySettings } from '@/server/services/settings';

export const metadata = { title: 'Nova venda' };

export default async function NewSalePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission('sales.create');
  const params = await searchParams;
  const customerId = Number(param(params, 'clienteId'));
  const [company, customer] = await Promise.all([
    getCompanySettings(),
    Number.isInteger(customerId) && customerId > 0 && hasPermission(user, 'customers.view') ? getCustomer(customerId) : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader title="Nova venda" crumbs={[{ label: 'Vendas', href: '/sistema/vendas' }, { label: 'Nova' }]} subtitle="Registre os produtos vendidos e, se quiser, já receba o pagamento." />
      <SaleForm
        action={createSaleAction}
        today={todayISO(company.timezone)}
        acceptedMethods={company.paymentMethods.filter(isPaymentMethod) as PaymentMethod[]}
        canCreateCustomer={hasPermission(user, 'customers.create')}
        canPay={hasPermission(user, 'payments.create')}
        canPrint={hasPermission(user, 'documents.print') && hasPermission(user, 'sales.view')}
        customer={customer ? { id: customer.id, name: customer.name, phone: customer.phone, address: customer.address, isDemo: customer.isDemo } : null}
      />
    </>
  );
}

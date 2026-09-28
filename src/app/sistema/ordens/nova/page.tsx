import { createOrderAction } from '@/actions/orders';
import { OrderForm } from '@/components/system/orders/OrderForm';
import { PageHeader } from '@/components/ui/PageHeader';
import { isPaymentMethod, type PaymentMethod } from '@/config/payment-methods';
import { todayISO } from '@/lib/dates';
import { param, type SearchParams } from '@/lib/query';
import { requirePagePermission } from '@/server/auth/session';
import { hasPermission } from '@/server/auth/types';
import { getCustomer } from '@/server/services/customers';
import { getCompanySettings } from '@/server/services/settings';
import { listTechnicianOptions } from '@/server/services/users';

export const metadata = { title: 'Nova ordem de serviço' };

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission('orders.create');
  const params = await searchParams;
  const customerId = Number(param(params, 'clienteId'));
  const [company, technicians, customer] = await Promise.all([
    getCompanySettings(),
    listTechnicianOptions(),
    Number.isInteger(customerId) && customerId > 0 && hasPermission(user, 'customers.view') ? getCustomer(customerId) : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader
        title="Nova ordem de serviço"
        crumbs={[{ label: 'Ordens de Serviço', href: '/sistema/ordens' }, { label: 'Nova' }]}
        subtitle="Cadastre o equipamento, o problema e os valores. O número da OS é gerado automaticamente."
      />
      <OrderForm
        mode="create"
        action={createOrderAction}
        customer={customer ? { id: customer.id, name: customer.name, phone: customer.phone, address: customer.address, isDemo: customer.isDemo } : null}
        technicians={technicians}
        today={todayISO(company.timezone)}
        acceptedMethods={company.paymentMethods.filter(isPaymentMethod) as PaymentMethod[]}
        canCreateCustomer={hasPermission(user, 'customers.create')}
        cancelHref="/sistema/ordens"
      />
    </>
  );
}

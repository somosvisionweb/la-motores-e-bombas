import { notFound } from 'next/navigation';
import { updateCustomerAction } from '@/actions/customers';
import { CustomerForm } from '@/components/system/customers/CustomerForm';
import { Card, CardBody } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { requirePagePermission } from '@/server/auth/session';
import { getCustomer } from '@/server/services/customers';

export const metadata = { title: 'Editar cliente' };

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission('customers.edit');
  const { id } = await params;
  const customer = Number.isInteger(Number(id)) ? await getCustomer(Number(id)) : null;
  if (!customer) notFound();

  return (
    <div className="page--narrow" style={{ marginInline: 'auto' }}>
      <PageHeader
        title="Editar cliente"
        crumbs={[{ label: 'Clientes', href: '/sistema/clientes' }, { label: customer.name, href: `/sistema/clientes/${customer.id}` }, { label: 'Editar' }]}
      />
      <Card>
        <CardBody>
          <CustomerForm action={updateCustomerAction} customer={customer} cancelHref={`/sistema/clientes/${customer.id}`} submitLabel="Salvar alterações" />
        </CardBody>
      </Card>
    </div>
  );
}

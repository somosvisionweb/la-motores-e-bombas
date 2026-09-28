import { createCustomerAction } from '@/actions/customers';
import { CustomerForm } from '@/components/system/customers/CustomerForm';
import { Card, CardBody } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { firstParam, type SearchParams } from '@/lib/query';
import { requirePagePermission } from '@/server/auth/session';

export const metadata = { title: 'Novo cliente' };

export default async function NewCustomerPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePagePermission('customers.create');
  const params = await searchParams;
  const returnTo = firstParam(params.retorno);

  return (
    <div className="page--narrow" style={{ marginInline: 'auto' }}>
      <PageHeader
        title="Novo cliente"
        crumbs={[{ label: 'Clientes', href: '/sistema/clientes' }, { label: 'Novo' }]}
        subtitle="Preencha os dados básicos. Você pode completar o cadastro depois."
      />
      <Card>
        <CardBody>
          <CustomerForm action={createCustomerAction} returnTo={returnTo} cancelHref={returnTo ?? '/sistema/clientes'} />
        </CardBody>
      </Card>
    </div>
  );
}

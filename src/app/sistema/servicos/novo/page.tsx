import { createServiceAction } from '@/actions/services';
import { ServiceForm } from '@/components/system/catalog/ServiceForm';
import { Card, CardBody } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { requirePagePermission } from '@/server/auth/session';
import { listServiceCategories } from '@/server/services/catalog-services';

export const metadata = { title: 'Novo serviço' };

export default async function NewServicePage() {
  await requirePagePermission('services.manage');
  const categories = await listServiceCategories();
  return (
    <div className="page--narrow" style={{ marginInline: 'auto' }}>
      <PageHeader title="Novo serviço" crumbs={[{ label: 'Serviços', href: '/sistema/servicos' }, { label: 'Novo' }]} />
      <Card>
        <CardBody>
          <ServiceForm action={createServiceAction} categories={categories} />
        </CardBody>
      </Card>
    </div>
  );
}

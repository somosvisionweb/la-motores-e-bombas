import { notFound } from 'next/navigation';
import { updateServiceAction } from '@/actions/services';
import { ServiceForm } from '@/components/system/catalog/ServiceForm';
import { Card, CardBody } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { requirePagePermission } from '@/server/auth/session';
import { getService, listServiceCategories } from '@/server/services/catalog-services';

export const metadata = { title: 'Editar serviço' };

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission('services.manage');
  const { id } = await params;
  const service = Number.isInteger(Number(id)) ? await getService(Number(id)) : null;
  if (!service) notFound();
  const categories = await listServiceCategories();
  return (
    <div className="page--narrow" style={{ marginInline: 'auto' }}>
      <PageHeader title="Editar serviço" crumbs={[{ label: 'Serviços', href: '/sistema/servicos' }, { label: service.name }]} />
      <Card>
        <CardBody>
          <ServiceForm action={updateServiceAction} service={service} categories={categories} />
        </CardBody>
      </Card>
    </div>
  );
}

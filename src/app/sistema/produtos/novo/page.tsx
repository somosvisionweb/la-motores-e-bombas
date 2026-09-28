import { createProductAction } from '@/actions/products';
import { ProductForm } from '@/components/system/catalog/ProductForm';
import { Card, CardBody } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { param, type SearchParams } from '@/lib/query';
import { requirePagePermission } from '@/server/auth/session';
import { listProductCategories } from '@/server/services/products';

export const metadata = { title: 'Novo produto' };

export default async function NewProductPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePagePermission('products.manage');
  const fromStore = param(await searchParams, 'origem') === 'loja';
  const categories = await listProductCategories();
  return (
    <div className="page--narrow" style={{ marginInline: 'auto' }}>
      <PageHeader
        title="Novo produto"
        crumbs={fromStore ? [{ label: 'Loja online', href: '/sistema/loja' }, { label: 'Produtos da loja', href: '/sistema/loja/produtos' }, { label: 'Novo' }] : [{ label: 'Produtos', href: '/sistema/produtos' }, { label: 'Novo' }]}
      />
      <Card>
        <CardBody>
          <ProductForm action={createProductAction} categories={categories} fromStore={fromStore} />
        </CardBody>
      </Card>
    </div>
  );
}

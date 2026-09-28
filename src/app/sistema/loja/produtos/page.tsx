import Link from 'next/link';
import { ExternalLink, Package, Plus } from 'lucide-react';
import { StoreAdminTabs } from '@/components/system/store/StoreAdminTabs';
import { StoreCatalogEditor, type CatalogRow } from '@/components/system/store/StoreCatalogEditor';
import { QuickAddProduct } from '@/components/system/store/QuickAddProduct';
import { FilterBar, FilterSelect, SearchField } from '@/components/system/FilterBar';
import { Alert } from '@/components/ui/Alert';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { StatCard } from '@/components/ui/StatCard';
import { param, parsePage, type SearchParams } from '@/lib/query';
import { STORE_LISTING_KEYS, STORE_LISTING_STATUS, storeListingStatus, type StoreListingStatus } from '@/lib/store-pricing';
import { requirePagePermission } from '@/server/auth/session';
import { hasPermission } from '@/server/auth/types';
import { listProductCategories } from '@/server/services/products';
import { listStoreCatalog, storeCatalogSummary } from '@/server/services/store-catalog';
import { getStoreSettings } from '@/server/services/store-settings';

export const metadata = { title: 'Produtos da loja' };

const PAGE_SIZE = 50;

export default async function StoreCatalogPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission('products.view');
  const params = await searchParams;
  const q = param(params, 'q');
  const requested = param(params, 'situacao') as StoreListingStatus;
  const status = (STORE_LISTING_KEYS as readonly string[]).includes(requested) ? requested : undefined;
  const page = parsePage(params);
  const canManage = hasPermission(user, 'products.manage');

  const [{ rows, total }, summary, categories, config] = await Promise.all([
    listStoreCatalog({ q, status, page, pageSize: PAGE_SIZE }),
    storeCatalogSummary(),
    listProductCategories(),
    getStoreSettings(),
  ]);
  const basePath = '/sistema/loja/produtos';

  const catalogRows: CatalogRow[] = rows.map((product) => ({
    id: product.id,
    name: product.name,
    code: product.code,
    iconKey: product.iconKey,
    imageFileId: product.imageFileId,
    category: product.category,
    unit: product.unit,
    salePriceCents: product.salePriceCents,
    demoPriceCents: product.demoPriceCents,
    stock: product.stock,
    sellOnline: product.sellOnline,
    showOnSite: product.showOnSite,
    status: storeListingStatus(product),
  }));

  return (
    <>
      <PageHeader
        title="Produtos da loja"
        subtitle="Escolha o que aparece na loja, defina preço e estoque e adicione novos itens."
        actions={
          <>
            <Link href="/loja" target="_blank" className="btn">
              <ExternalLink aria-hidden="true" /> Ver a loja
            </Link>
            {canManage ? (
              <Link href="/sistema/produtos/novo?origem=loja" className="btn btn--primary">
                <Plus aria-hidden="true" /> Novo produto completo
              </Link>
            ) : null}
          </>
        }
      />
      <StoreAdminTabs active="produtos" canSeeCatalog canSeeSettings={hasPermission(user, 'settings.manage')} />

      <div className="stack" style={{ ['--gap' as string]: '16px' }}>
        {!config.enabled ? (
          <Alert variant="warning" title="A loja virtual está fechada">
            Os produtos aparecem no site só para consulta. Para abrir a loja, use <Link href="/sistema/configuracoes/loja">Configurações → Loja virtual</Link>.
          </Alert>
        ) : null}

        <div className="grid grid--5">
          <StatCard label="À venda agora" value={summary.ON_SALE} meta="Com preço e estoque" accent="green" />
          <StatCard label="Sem preço" value={summary.NO_PRICE} meta="Aparecem como “valor sob consulta”" accent={summary.NO_PRICE > 0 ? 'red' : 'navy'} />
          <StatCard label="Sem estoque" value={summary.OUT_OF_STOCK} meta="Aparecem como “esgotado”" accent="navy" />
          <StatCard label="Só consulta" value={summary.CONSULT_ONLY} meta="“Vender online” desmarcado" accent="navy" />
          <StatCard label="Ocultos" value={summary.HIDDEN} meta="Inativos ou fora do site" accent="navy" />
        </div>

        {canManage ? <QuickAddProduct categories={categories} /> : null}

        <Card>
          <FilterBar clearHref={basePath} hasFilters={Boolean(q || status)}>
            <SearchField defaultValue={q} placeholder="Nome, código ou categoria…" />
            <FilterSelect
              name="situacao"
              label="Situação na loja"
              defaultValue={status}
              allLabel="Todas"
              options={STORE_LISTING_KEYS.map((key) => ({ value: key, label: STORE_LISTING_STATUS[key].label }))}
            />
          </FilterBar>
          {catalogRows.length === 0 ? (
            <EmptyState icon={<Package size={26} aria-hidden="true" />} title={q || status ? 'Nenhum produto com esse filtro' : 'Nenhum produto cadastrado'}>
              {q || status ? 'Ajuste a busca ou a situação.' : 'Use “Adicionar item à loja” acima para cadastrar o primeiro produto.'}
            </EmptyState>
          ) : (
            <StoreCatalogEditor rows={catalogRows} categories={categories} canEdit={canManage} />
          )}
          <Pagination page={page} total={total} basePath={basePath} params={params} pageSize={PAGE_SIZE} noun="produtos" />
        </Card>
      </div>
    </>
  );
}

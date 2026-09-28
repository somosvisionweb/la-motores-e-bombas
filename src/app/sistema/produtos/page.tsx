import Link from 'next/link';
import { AlertTriangle, Boxes, Package, Plus, Store, Wallet } from 'lucide-react';
import { StoreListingBadge } from '@/components/system/store/StoreBadges';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Money } from '@/components/ui/Money';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { ProductIcon } from '@/components/ui/ProductIcon';
import { SortHeader } from '@/components/ui/SortHeader';
import { StatCard } from '@/components/ui/StatCard';
import { FilterBar, FilterSelect, SearchField } from '@/components/system/FilterBar';
import { formatInt } from '@/lib/money';
import { param, parsePage, parseSort, type SearchParams } from '@/lib/query';
import { storeListingStatus } from '@/lib/store-pricing';
import { requirePagePermission } from '@/server/auth/session';
import { hasPermission } from '@/server/auth/types';
import { listProductCategories, listProducts, PRODUCT_SORT_KEYS, productsSummary } from '@/server/services/products';

export const metadata = { title: 'Produtos' };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission('products.view');
  const params = await searchParams;
  const q = param(params, 'q');
  const category = param(params, 'categoria');
  const low = param(params, 'estoque') === 'baixo';
  const page = parsePage(params);
  const sort = parseSort(params, PRODUCT_SORT_KEYS, { key: 'name', dir: 'asc' });
  const canManage = hasPermission(user, 'products.manage');
  const canSeeCost = hasPermission(user, 'finance.view') || canManage;

  const [{ rows, total }, categories, summary] = await Promise.all([
    listProducts({ q, category: category || undefined, low, sort: sort.key, dir: sort.dir, page }),
    listProductCategories(),
    productsSummary(),
  ]);
  const basePath = '/sistema/produtos';

  return (
    <>
      <PageHeader
        title="Produtos"
        subtitle="Componentes e peças à venda, com controle de estoque."
        actions={
          <>
            <Link href="/sistema/loja/produtos" className="btn">
              <Store aria-hidden="true" /> Produtos da loja
            </Link>
            {canManage ? (
              <Link href={`${basePath}/novo`} className="btn btn--primary">
                <Plus aria-hidden="true" /> Novo produto
              </Link>
            ) : null}
          </>
        }
      />

      <div className="grid grid--4" style={{ marginBottom: 20 }}>
        <StatCard label="Produtos ativos" value={formatInt(summary.active)} meta={`${formatInt(summary.total)} cadastrados`} icon={<Package />} accent="navy" />
        <StatCard
          label="Estoque baixo"
          value={formatInt(summary.low)}
          meta={summary.negative ? `${summary.negative} com saldo negativo` : 'Abaixo ou no mínimo definido'}
          icon={<AlertTriangle />}
          accent={summary.low ? 'red' : 'green'}
        />
        {canSeeCost ? (
          <>
            <StatCard label="Valor em estoque (custo)" value={<Money cents={summary.costValueCents} />} icon={<Wallet />} accent="navy" />
            <StatCard label="Valor em estoque (venda)" value={<Money cents={summary.saleValueCents} />} icon={<Boxes />} accent="green" />
          </>
        ) : null}
      </div>

      <Card>
        <FilterBar clearHref={basePath} hasFilters={Boolean(q || category || low)} keep={{ ordem: param(params, 'ordem'), dir: param(params, 'dir') }}>
          <SearchField defaultValue={q} placeholder="Nome, código ou categoria…" />
          <FilterSelect name="categoria" label="Categoria" defaultValue={category} options={categories.map((c) => ({ value: c, label: c }))} allLabel="Todas" />
          <FilterSelect name="estoque" label="Estoque" defaultValue={low ? 'baixo' : ''} options={[{ value: 'baixo', label: 'Somente estoque baixo' }]} allLabel="Todos" />
        </FilterBar>

        {rows.length === 0 ? (
          <EmptyState icon={<Package size={26} aria-hidden="true" />} title="Nenhum produto encontrado">
            Ajuste os filtros ou cadastre um novo produto.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table table--stack">
              <thead>
                <tr>
                  <SortHeader label="Produto" sortKey="name" current={sort} basePath={basePath} params={params} />
                  <SortHeader label="Categoria" sortKey="category" current={sort} basePath={basePath} params={params} />
                  <SortHeader label="Estoque" sortKey="stock" current={sort} basePath={basePath} params={params} numeric />
                  <th scope="col" className="num">
                    Mínimo
                  </th>
                  <SortHeader label="Preço de venda" sortKey="price" current={sort} basePath={basePath} params={params} numeric />
                  {canSeeCost ? (
                    <th scope="col" className="num">
                      Custo
                    </th>
                  ) : null}
                  <th scope="col">Na loja</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const isLow = p.minStock > 0 && p.stock <= p.minStock;
                  return (
                    <tr key={p.id}>
                      <td className="cell-primary" data-label="">
                        <span className="cluster" style={{ gap: 12, flexWrap: 'nowrap' }}>
                          <span className="empty__icon" style={{ width: 40, height: 40, borderRadius: 10 }}>
                            <ProductIcon iconKey={p.iconKey} size={26} />
                          </span>
                          <span>
                            <Link href={`${basePath}/${p.id}`}>{p.name}</Link>
                            {!p.isActive ? (
                              <>
                                {' '}
                                <Badge tone="slate">Inativo</Badge>
                              </>
                            ) : null}
                            <span className="cell-sub mono">{p.code}</span>
                          </span>
                        </span>
                      </td>
                      <td data-label="Categoria" className="text-muted">
                        {p.category}
                      </td>
                      <td className="num" data-label="Estoque">
                        <span className="cluster" style={{ gap: 8, justifyContent: 'flex-end' }}>
                          {p.stock < 0 ? <Badge tone="red">Negativo</Badge> : isLow ? <Badge tone="amber">Baixo</Badge> : null}
                          <strong>
                            {formatInt(p.stock)} <span className="text-muted" style={{ fontWeight: 400 }}>{p.unit}</span>
                          </strong>
                        </span>
                      </td>
                      <td className="num text-muted" data-label="Mínimo">
                        {p.minStock || '—'}
                      </td>
                      <td className="num" data-label="Preço de venda">
                        {p.salePriceCents > 0 ? <Money cents={p.salePriceCents} /> : <span className="text-subtle">A definir</span>}
                      </td>
                      {canSeeCost ? (
                        <td className="num" data-label="Custo">
                          {p.costCents > 0 ? <Money cents={p.costCents} tone="muted" /> : <span className="text-subtle">—</span>}
                        </td>
                      ) : null}
                      <td data-label="Na loja">
                        <StoreListingBadge status={storeListingStatus(p)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} total={total} basePath={basePath} params={params} noun="produtos" />
      </Card>
    </>
  );
}

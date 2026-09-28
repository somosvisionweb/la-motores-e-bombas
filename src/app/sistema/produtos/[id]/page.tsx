import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { deleteProductAction, updateProductAction } from '@/actions/products';
import { ProductForm } from '@/components/system/catalog/ProductForm';
import { StockAdjustDialog } from '@/components/system/catalog/StockAdjustDialog';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmActionForm } from '@/components/ui/ConfirmActionForm';
import { Money } from '@/components/ui/Money';
import { PageHeader } from '@/components/ui/PageHeader';
import { STOCK_REASON_LABEL } from '@/config/payment-methods';
import { formatOrderCode, formatSaleCode } from '@/lib/codes';
import { formatDateTimeBR } from '@/lib/dates';
import { StoreListingBadge } from '@/components/system/store/StoreBadges';
import { param, type SearchParams } from '@/lib/query';
import { storeListingStatus } from '@/lib/store-pricing';
import { requirePagePermission } from '@/server/auth/session';
import { hasPermission } from '@/server/auth/types';
import { getProduct, listProductCategories, listStockMovements } from '@/server/services/products';

export const metadata = { title: 'Produto' };

export default async function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const user = await requirePagePermission('products.view');
  const { id } = await params;
  const fromStore = param(await searchParams, 'origem') === 'loja';
  const product = Number.isInteger(Number(id)) ? await getProduct(Number(id)) : null;
  if (!product) notFound();

  const canManage = hasPermission(user, 'products.manage');
  const listing = storeListingStatus(product);
  const listHref = fromStore ? '/sistema/loja/produtos' : '/sistema/produtos';
  const [movements, categories] = await Promise.all([listStockMovements(product.id), listProductCategories()]);
  const isLow = product.minStock > 0 && product.stock <= product.minStock;

  return (
    <>
      <PageHeader
        title={product.name}
        badges={
          <>
            {!product.isActive ? <Badge tone="slate">Inativo</Badge> : null} <StoreListingBadge status={listing} />
          </>
        }
        crumbs={fromStore ? [{ label: 'Loja online', href: '/sistema/loja' }, { label: 'Produtos da loja', href: '/sistema/loja/produtos' }, { label: product.name }] : [{ label: 'Produtos', href: '/sistema/produtos' }, { label: product.name }]}
        subtitle={<span className="mono">{product.code}</span>}
        actions={
          <>
            {hasPermission(user, 'products.stock') ? <StockAdjustDialog productId={product.id} productName={product.name} current={product.stock} unit={product.unit} /> : null}
            {canManage ? (
              <ConfirmActionForm
                action={deleteProductAction}
                fields={{ id: product.id }}
                title="Excluir produto?"
                message={
                  <>
                    <strong>{product.name}</strong> será removido do cadastro. Produtos já usados em ordens de serviço ou vendas não podem ser excluídos — desative-os.
                  </>
                }
                confirmLabel="Excluir produto"
                triggerLabel="Excluir"
                triggerIcon={<Trash2 aria-hidden="true" />}
                triggerSize="md"
              />
            ) : null}
          </>
        }
      />

      <div className="page-grid">
        <div className="stack" style={{ ['--gap' as string]: '20px' }}>
          <Card>
            <CardHeader title={canManage ? 'Dados do produto' : 'Detalhes'} />
            <CardBody>
              {canManage ? (
                <ProductForm action={updateProductAction} product={product} categories={categories} fromStore={fromStore} />
              ) : (
                <dl className="kv">
                  <dt>Categoria</dt>
                  <dd>{product.category}</dd>
                  <dt>Preço de venda</dt>
                  <dd>{product.salePriceCents > 0 ? <Money cents={product.salePriceCents} /> : 'A definir'}</dd>
                  <dt>Unidade</dt>
                  <dd>{product.unit}</dd>
                  <dt>Observações</dt>
                  <dd>{product.notes || '—'}</dd>
                </dl>
              )}
            </CardBody>
          </Card>
        </div>

        <aside className="stack" style={{ ['--gap' as string]: '16px' }}>
          <div className={`stat ${isLow || product.stock < 0 ? 'stat--red' : 'stat--green'}`}>
            <div className="stat__top">
              <span className="stat__label">Estoque atual</span>
              {isLow || product.stock < 0 ? <Badge tone={product.stock < 0 ? 'red' : 'amber'}>{product.stock < 0 ? 'Negativo' : 'Baixo'}</Badge> : null}
            </div>
            <div className="stat__value">
              {product.stock} <span style={{ fontSize: 16, fontWeight: 500 }}>{product.unit}</span>
            </div>
            <div className="stat__meta">{product.minStock ? `Mínimo definido: ${product.minStock}` : 'Sem estoque mínimo definido'}</div>
          </div>

          <Card>
            <CardHeader title="Movimentações" subtitle="Últimos lançamentos de estoque" />
            <CardBody flush>
              {movements.length === 0 ? (
                <p className="text-muted" style={{ padding: 20 }}>
                  Nenhuma movimentação registrada.
                </p>
              ) : (
                <ul>
                  {movements.map((m) => (
                    <li key={m.id} style={{ padding: '10px 20px', borderBottom: '1px solid var(--gray-150)' }}>
                      <div className="cluster" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                        <strong className="tabular" style={{ color: m.delta > 0 ? 'var(--color-value)' : 'var(--color-danger)' }}>
                          {m.delta > 0 ? '+' : ''}
                          {m.delta}
                        </strong>
                        <span className="text-muted" style={{ fontSize: 12 }}>
                          {formatDateTimeBR(m.createdAt)}
                        </span>
                      </div>
                      <p style={{ fontSize: 13 }}>
                        {STOCK_REASON_LABEL[m.reason]}
                        {m.refType === 'service_order' && m.refNumber ? (
                          <>
                            {' · '}
                            <Link href={`/sistema/ordens/${m.refId}`}>{formatOrderCode(Number(m.refNumber))}</Link>
                          </>
                        ) : null}
                        {m.refType === 'sale' && m.refNumber ? (
                          <>
                            {' · '}
                            <Link href={`/sistema/vendas/${m.refId}`}>{formatSaleCode(Number(m.refNumber))}</Link>
                          </>
                        ) : null}
                      </p>
                      {m.note || m.userName ? (
                        <p className="text-muted" style={{ fontSize: 12 }}>
                          {[m.note, m.userName].filter(Boolean).join(' — ')}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          <Link href={listHref} className="btn btn--ghost">
            {fromStore ? '← Voltar para produtos da loja' : '← Voltar para produtos'}
          </Link>
        </aside>
      </div>
    </>
  );
}

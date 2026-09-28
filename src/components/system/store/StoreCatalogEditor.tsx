'use client';

import Link from 'next/link';
import { Package } from 'lucide-react';
import { bulkUpdateStoreProductsAction } from '@/actions/products';
import { ActionForm } from '@/components/form/ActionForm';
import { ProductIcon } from '@/components/ui/ProductIcon';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { formatDecimalBR } from '@/lib/money';
import type { StoreListingStatus } from '@/lib/store-pricing';
import { StoreListingBadge } from './StoreBadges';

export interface CatalogRow {
  id: number;
  name: string;
  code: string | null;
  iconKey: string | null;
  imageFileId: number | null;
  category: string;
  unit: string;
  salePriceCents: number;
  demoPriceCents: number | null;
  stock: number;
  sellOnline: boolean;
  showOnSite: boolean;
  status: StoreListingStatus;
}

/**
 * Tabela de edição rápida: categoria, preço, estoque e visibilidade de cada produto. Um único botão salva tudo;
 * o formulário leva os valores originais de cada linha para gravar só o que foi alterado.
 */
export function StoreCatalogEditor({ rows, categories, canEdit }: { rows: CatalogRow[]; categories: string[]; canEdit: boolean }) {
  const table = (
    <div className="table-wrap">
      <table className="table table--stack catalog-table">
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Categoria</th>
            <th scope="col">Preço de venda</th>
            <th scope="col">Estoque</th>
            <th scope="col">No site</th>
            <th scope="col">Vende online</th>
            <th scope="col">Situação na loja</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const original = JSON.stringify({ category: row.category, price: row.salePriceCents, stock: row.stock, sell: row.sellOnline, show: row.showOnSite });
            const usingDemoPrice = row.salePriceCents === 0 && (row.demoPriceCents ?? 0) > 0;
            return (
              <tr key={row.id}>
                <td className="cell-primary" data-label="">
                  {canEdit ? (
                    <>
                      <input type="hidden" name="id" value={row.id} />
                      <input type="hidden" name={`orig-${row.id}`} value={original} />
                    </>
                  ) : null}
                  <span className="cluster" style={{ gap: 12, flexWrap: 'nowrap' }}>
                    <span className="empty__icon catalog-thumb">
                      {row.imageFileId ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/media/${row.imageFileId}`} alt="" width={40} height={40} />
                      ) : (
                        <ProductIcon iconKey={row.iconKey} size={26} />
                      )}
                    </span>
                    <span>
                      <Link href={`/sistema/produtos/${row.id}?origem=loja`}>{row.name}</Link>
                      <span className="cell-sub mono">{row.code}</span>
                    </span>
                  </span>
                </td>
                <td data-label="Categoria">
                  {canEdit ? (
                    <input className="input input--sm" name={`category-${row.id}`} defaultValue={row.category} list="catalog-categories" maxLength={80} aria-label={`Categoria de ${row.name}`} />
                  ) : (
                    <span className="text-muted">{row.category}</span>
                  )}
                </td>
                <td data-label="Preço de venda">
                  {canEdit ? (
                    <div className="input-group catalog-price">
                      <span className="input-group__addon" aria-hidden="true">
                        R$
                      </span>
                      <input
                        className="input input--sm tabular"
                        name={`price-${row.id}`}
                        defaultValue={row.salePriceCents > 0 ? formatDecimalBR(row.salePriceCents) : ''}
                        placeholder="0,00"
                        inputMode="decimal"
                        autoComplete="off"
                        aria-label={`Preço de venda de ${row.name}`}
                      />
                    </div>
                  ) : row.salePriceCents > 0 ? (
                    <span className="tabular">R$ {formatDecimalBR(row.salePriceCents)}</span>
                  ) : (
                    <span className="text-subtle">A definir</span>
                  )}
                </td>
                <td data-label="Estoque">
                  {canEdit ? (
                    <span className="cluster" style={{ gap: 6, flexWrap: 'nowrap' }}>
                      <input className="input input--sm tabular catalog-stock" type="number" name={`stock-${row.id}`} defaultValue={row.stock} step={1} inputMode="numeric" aria-label={`Estoque de ${row.name}`} />
                      <span className="text-muted">{row.unit}</span>
                    </span>
                  ) : (
                    <span className="tabular">
                      {row.stock} {row.unit}
                    </span>
                  )}
                </td>
                <td data-label="No site">
                  <label className="check">
                    <input type="checkbox" name={`show-${row.id}`} defaultChecked={row.showOnSite} disabled={!canEdit} aria-label={`Mostrar ${row.name} no site`} />
                    <span className="sr-only">Mostrar no site</span>
                  </label>
                </td>
                <td data-label="Vende online">
                  <label className="check">
                    <input type="checkbox" name={`sell-${row.id}`} defaultChecked={row.sellOnline} disabled={!canEdit} aria-label={`Vender ${row.name} na loja virtual`} />
                    <span className="sr-only">Vender na loja virtual</span>
                  </label>
                </td>
                <td data-label="Situação na loja">
                  <StoreListingBadge status={row.status} />
                  {usingDemoPrice ? <span className="cell-sub">usando preço de demonstração</span> : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  if (!canEdit) return table;

  return (
    <ActionForm action={bulkUpdateStoreProductsAction} className="catalog-editor" successToast keepValues>
      <datalist id="catalog-categories">
        {categories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>
      {table}
      <div className="catalog-editor__bar">
        <SubmitButton pendingLabel="Salvando…">
          <Package aria-hidden="true" /> Salvar alterações
        </SubmitButton>
        <span className="text-muted">Só o que você alterou é gravado. Mudanças de estoque ficam registradas como ajuste no histórico de cada produto.</span>
      </div>
    </ActionForm>
  );
}

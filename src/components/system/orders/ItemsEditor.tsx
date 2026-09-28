'use client';

import { useState } from 'react';
import { AlertTriangle, Package, Plus, Trash2, Wrench } from 'lucide-react';
import { MoneyInput } from '@/components/form/MoneyInput';
import { LookupInput } from '@/components/ui/LookupInput';
import type { ItemKind } from '@/config/payment-methods';
import { formatBRL } from '@/lib/money';
import { lineTotal } from '@/lib/money';
import { formatInt } from '@/lib/money';

export interface ItemDraft {
  key: string;
  kind: ItemKind;
  serviceId: number | null;
  productId: number | null;
  /** Nome do cadastro ao qual o item está vinculado (se o texto mudar, o vínculo é desfeito). */
  linkedName: string | null;
  description: string;
  quantity: number;
  unitPriceCents: number;
  stock?: number | null;
  unit?: string | null;
}

interface ServiceResult {
  id: number;
  name: string;
  defaultPriceCents: number | null;
  category: string;
}
interface ProductResult {
  id: number;
  name: string;
  code: string | null;
  salePriceCents: number;
  costCents: number;
  stock: number;
  unit: string;
}

let keyCounter = 0;
export function newItemKey(): string {
  keyCounter += 1;
  return `item-${Date.now().toString(36)}-${keyCounter}`;
}

export function blankItem(kind: ItemKind): ItemDraft {
  return { key: newItemKey(), kind, serviceId: null, productId: null, linkedName: null, description: '', quantity: 1, unitPriceCents: 0 };
}

export function isBlankItem(item: ItemDraft): boolean {
  return !item.description.trim() && item.unitPriceCents === 0 && !item.productId && !item.serviceId;
}

export function ItemsEditor({
  items,
  onChange,
  errors,
  payloadIndex,
  kinds = ['SERVICE', 'PART'],
  productLabel = 'Peça',
}: {
  items: ItemDraft[];
  onChange: (items: ItemDraft[]) => void;
  /** Erros do servidor por campo (ex.: "items.1.unitPriceCents"). */
  errors: Record<string, string> | undefined;
  /** Posição de cada linha no payload enviado (linhas em branco são descartadas). */
  payloadIndex: Map<string, number>;
  /** Tipos de item permitidos (vendas usam apenas produtos). */
  kinds?: ItemKind[];
  productLabel?: string;
}) {
  // Linha recém-adicionada: recebe o foco ao aparecer.
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  const update = (key: string, patch: Partial<ItemDraft>) => onChange(items.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  const remove = (key: string) => onChange(items.filter((item) => item.key !== key));
  const add = (kind: ItemKind) => {
    const item = blankItem(kind);
    setLastAdded(item.key);
    onChange([...items, item]);
  };
  const errorFor = (key: string, field: string) => {
    const index = payloadIndex.get(key);
    return index === undefined ? undefined : errors?.[`items.${index}.${field}`];
  };

  return (
    <div className="items-editor">
      {items.length === 0 ? (
        <div className="items-editor__empty">
          <p className="text-muted">
            {kinds.includes('SERVICE') ? 'Nenhum item ainda. Adicione os serviços (mão de obra) e as peças usadas.' : 'Nenhum item ainda. Adicione os produtos vendidos.'}
          </p>
        </div>
      ) : (
        <>
          <div className="items-editor__head" aria-hidden="true">
            <span>Tipo</span>
            <span>Descrição</span>
            <span>Qtd.</span>
            <span>Valor unitário</span>
            <span className="num">Total</span>
            <span />
          </div>
          {items.map((item, index) => {
            const descError = errorFor(item.key, 'description');
            const stockWarning = item.kind === 'PART' && item.productId && typeof item.stock === 'number' && item.quantity > item.stock;
            return (
              <div className="item-row" key={item.key}>
                <span className={`item-row__kind item-row__kind--${item.kind === 'SERVICE' ? 'service' : 'part'}`}>
                  {item.kind === 'SERVICE' ? <Wrench aria-hidden="true" /> : <Package aria-hidden="true" />}
                  {item.kind === 'SERVICE' ? 'Serviço' : productLabel}
                </span>

                <div className="item-row__desc" data-label="Descrição">
                  {item.kind === 'SERVICE' ? (
                    <LookupInput<ServiceResult>
                      endpoint="/api/lookup/services"
                      value={item.description}
                      onValueChange={(text) => update(item.key, { description: text, ...(text !== item.linkedName ? { serviceId: null, linkedName: null } : {}) })}
                      onPick={(service) =>
                        update(item.key, {
                          description: service.name,
                          serviceId: service.id,
                          linkedName: service.name,
                          ...(service.defaultPriceCents !== null && item.unitPriceCents === 0 ? { unitPriceCents: service.defaultPriceCents } : {}),
                        })
                      }
                      ariaLabel={`Descrição do serviço ${index + 1}`}
                      placeholder="Ex.: Rebobinamento de motores elétricos"
                      autoFocus={lastAdded === item.key}
                      invalid={Boolean(descError)}
                      icon={false}
                      renderItem={(service) => (
                        <span>
                          <span style={{ fontWeight: 600 }}>{service.name}</span>
                          <span className="text-muted" style={{ display: 'block', fontSize: 12 }}>
                            {service.category} · {service.defaultPriceCents !== null ? formatBRL(service.defaultPriceCents) : 'a combinar'}
                          </span>
                        </span>
                      )}
                    />
                  ) : (
                    <LookupInput<ProductResult>
                      endpoint="/api/lookup/products"
                      value={item.description}
                      onValueChange={(text) => update(item.key, { description: text, ...(text !== item.linkedName ? { productId: null, linkedName: null, stock: null, unit: null } : {}) })}
                      onPick={(product) =>
                        update(item.key, {
                          description: product.name,
                          productId: product.id,
                          linkedName: product.name,
                          stock: product.stock,
                          unit: product.unit,
                          ...(product.salePriceCents > 0 ? { unitPriceCents: product.salePriceCents } : {}),
                        })
                      }
                      ariaLabel={`Descrição da peça ${index + 1}`}
                      placeholder="Busque um produto ou digite uma peça"
                      autoFocus={lastAdded === item.key}
                      invalid={Boolean(descError)}
                      icon={false}
                      renderItem={(product) => (
                        <span style={{ flex: 1 }}>
                          <span style={{ fontWeight: 600 }}>{product.name}</span>
                          <span className="text-muted" style={{ display: 'block', fontSize: 12 }}>
                            {product.code} · {product.salePriceCents > 0 ? formatBRL(product.salePriceCents) : 'preço a definir'} · estoque {formatInt(product.stock)} {product.unit}
                          </span>
                        </span>
                      )}
                    />
                  )}
                  {descError ? (
                    <p className="field__error" role="alert">
                      {descError}
                    </p>
                  ) : null}
                  {item.kind === 'PART' && item.productId ? (
                    <p className={stockWarning ? 'field__error' : 'field__hint'} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {stockWarning ? <AlertTriangle size={14} aria-hidden="true" /> : null}
                      {stockWarning
                        ? `Estoque insuficiente: ${item.stock} ${item.unit ?? ''} disponível(is). O saldo ficará negativo.`
                        : `Vinculado ao estoque (${item.stock ?? 0} ${item.unit ?? ''} disponível). A baixa é automática.`}
                    </p>
                  ) : null}
                </div>

                <div data-label="Qtd.">
                  <input
                    type="number"
                    min={1}
                    max={100000}
                    step={1}
                    inputMode="numeric"
                    className="input tabular"
                    aria-label={`Quantidade do item ${index + 1}`}
                    value={item.quantity}
                    onChange={(event) => update(item.key, { quantity: Math.max(1, Math.floor(Number(event.target.value) || 1)) })}
                  />
                </div>

                <div data-label="Valor unitário">
                  <MoneyInput
                    cents={item.unitPriceCents}
                    onChange={(cents) => update(item.key, { unitPriceCents: cents ?? 0 })}
                    ariaLabel={`Valor unitário do item ${index + 1}`}
                    invalid={Boolean(errorFor(item.key, 'unitPriceCents'))}
                  />
                </div>

                <div className="item-row__total money" data-label="Total">
                  {formatBRL(lineTotal(item.quantity, item.unitPriceCents))}
                </div>

                <button type="button" className="btn btn--ghost btn--icon btn--sm" onClick={() => remove(item.key)} aria-label={`Remover item ${index + 1}`} title="Remover">
                  <Trash2 aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </>
      )}

      <div className="items-editor__actions">
        {kinds.includes('SERVICE') ? (
          <button type="button" className="btn btn--sm" onClick={() => add('SERVICE')}>
            <Plus aria-hidden="true" /> Serviço
          </button>
        ) : null}
        {kinds.includes('PART') ? (
          <button type="button" className="btn btn--sm" onClick={() => add('PART')}>
            <Plus aria-hidden="true" /> {kinds.includes('SERVICE') ? 'Peça / produto' : 'Produto'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

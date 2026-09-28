'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { ActionState } from '@/lib/action-state';
import { parseBRLToCents } from '@/lib/money';
import { idField } from '@/lib/validation/common';
import { productSchema, quickProductSchema, stockAdjustSchema, type ProductFormInput } from '@/lib/validation/catalog';
import { toActor } from '@/server/auth/types';
import { requireActionPermission } from '@/server/auth/session';
import { setFlash } from '@/server/flash';
import { removeProductImage, setProductImage } from '@/server/services/files';
import { adjustStock, createProduct, deleteProduct, updateProduct } from '@/server/services/products';
import { invalidateSiteCache } from '@/server/services/site';
import { bulkUpdateStoreProducts, getProductNames, type BulkProductChange } from '@/server/services/store-catalog';
import { formToObject, runAction, validationFailure } from './_helpers';

async function handleImage(productId: number, formData: FormData, actor: ReturnType<typeof toActor>): Promise<void> {
  if (formData.get('removeImage') === 'on') {
    await removeProductImage(productId);
    return;
  }
  const file = formData.get('image');
  if (file instanceof File && file.size > 0) {
    await setProductImage(productId, Buffer.from(await file.arrayBuffer()), file.name, actor);
  }
}

export async function createProductAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('products.manage');
    const parsed = productSchema.safeParse(formToObject(formData));
    if (!parsed.success) return validationFailure(parsed.error, formData);
    const actor = toActor(user);
    const product = await createProduct(parsed.data, actor);
    await handleImage(product.id, formData, actor);
    invalidateSiteCache();
    await setFlash('success', `Produto "${product.name}" cadastrado.`);
    // Cadastrado a partir da tela "Produtos da loja": volta para ela.
    redirect(formData.get('from') === 'loja' ? '/sistema/loja/produtos' : `/sistema/produtos/${product.id}`);
  });
}

export async function updateProductAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('products.manage');
    const id = idField('Produto').safeParse(formData.get('id'));
    if (!id.success) return { ok: false, message: 'Produto inválido.' };
    const parsed = productSchema.safeParse(formToObject(formData));
    if (!parsed.success) return validationFailure(parsed.error, formData);
    const actor = toActor(user);
    const product = await updateProduct(id.data, parsed.data, actor);
    await handleImage(product.id, formData, actor);
    invalidateSiteCache();
    revalidatePath('/sistema', 'layout');
    return { ok: true, message: 'Produto atualizado.' };
  });
}

export async function deleteProductAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('products.manage');
    const id = idField('Produto').safeParse(formData.get('id'));
    if (!id.success) return { ok: false, message: 'Produto inválido.' };
    await deleteProduct(id.data, toActor(user));
    invalidateSiteCache();
    await setFlash('success', 'Produto excluído.');
    redirect('/sistema/produtos');
  });
}

export async function adjustStockAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('products.stock');
    const id = idField('Produto').safeParse(formData.get('id'));
    if (!id.success) return { ok: false, message: 'Produto inválido.' };
    const parsed = stockAdjustSchema.safeParse(formToObject(formData));
    if (!parsed.success) return validationFailure(parsed.error, formData);
    const product = await adjustStock(id.data, parsed.data, toActor(user));
    revalidatePath('/sistema', 'layout');
    return { ok: true, message: `Estoque atualizado: ${product.stock} ${product.unit}.` };
  });
}

// ---------------------------------------------------------------------------
// Loja virtual: cadastro rápido e edição rápida (tela "Produtos da loja")
// ---------------------------------------------------------------------------

/** Adiciona um item à loja com o essencial (nome, categoria, preço, estoque e foto). Fica à venda assim que há preço e estoque. */
export async function quickAddProductAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('products.manage');
    const parsed = quickProductSchema.safeParse(formToObject(formData));
    if (!parsed.success) return validationFailure(parsed.error, formData);
    const input: ProductFormInput = {
      name: parsed.data.name,
      code: null,
      category: parsed.data.category,
      salePriceCents: parsed.data.salePriceCents,
      costCents: 0,
      stock: parsed.data.stock,
      minStock: 0,
      unit: 'un',
      notes: null,
      iconKey: 'component',
      isActive: true,
      showOnSite: true,
      sellOnline: true,
      storeDescription: null,
    };
    const actor = toActor(user);
    const product = await createProduct(input, actor);
    await handleImage(product.id, formData, actor);
    invalidateSiteCache();
    revalidatePath('/sistema', 'layout');
    return { ok: true, message: `"${product.name}" adicionado à loja.`, data: { id: product.id } };
  });
}

interface OriginalRow {
  category: string;
  price: number;
  stock: number;
  sell: boolean;
  show: boolean;
}

function parseOriginal(value: FormDataEntryValue | null): OriginalRow | null {
  if (typeof value !== 'string' || value.length > 400) return null;
  try {
    const data = JSON.parse(value) as Partial<OriginalRow>;
    if (typeof data.category !== 'string' || !Number.isInteger(data.price) || !Number.isInteger(data.stock)) return null;
    return { category: data.category, price: data.price as number, stock: data.stock as number, sell: Boolean(data.sell), show: Boolean(data.show) };
  } catch {
    return null;
  }
}

/**
 * Edição rápida: salva de uma vez a categoria, o preço, o estoque e a visibilidade dos produtos da tela.
 * Só o que foi alterado é gravado (o formulário leva junto os valores originais); o estoque vira um ajuste relativo,
 * então vendas feitas enquanto a tela estava aberta não são desfeitas.
 */
export async function bulkUpdateStoreProductsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('products.manage');
    const ids = [...new Set(formData.getAll('id').map((value) => Number(value)).filter((n) => Number.isSafeInteger(n) && n > 0))].slice(0, 200);
    if (ids.length === 0) return { ok: false, message: 'Nenhum produto para atualizar.' };

    const names = await getProductNames(ids);
    const changes: BulkProductChange[] = [];
    const problems: string[] = [];
    for (const id of ids) {
      const label = names.get(id) ?? `Produto ${id}`;
      const original = parseOriginal(formData.get(`orig-${id}`));
      if (!original) {
        problems.push(`${label}: recarregue a página e tente de novo.`);
        continue;
      }
      const change: BulkProductChange = { id };

      const category = String(formData.get(`category-${id}`) ?? '').trim();
      if (category !== original.category) {
        if (!category || category.length > 80) problems.push(`${label}: informe a categoria (até 80 caracteres).`);
        else change.category = category;
      }

      const priceText = String(formData.get(`price-${id}`) ?? '').trim();
      const price = priceText === '' ? 0 : parseBRLToCents(priceText);
      if (price === null || price < 0 || price > 1_000_000_000) problems.push(`${label}: preço inválido.`);
      else if (price !== original.price) change.salePriceCents = price;

      const stockText = String(formData.get(`stock-${id}`) ?? '').trim();
      if (stockText !== '') {
        const stock = Number(stockText);
        // Saldo que não foi mexido (mesmo negativo, por vendas acima do estoque) não é validado nem regravado.
        if (Number.isInteger(stock) && stock === original.stock) {
          /* sem alteração */
        } else if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) {
          problems.push(`${label}: estoque inválido (use um número inteiro, de 0 para cima).`);
        } else {
          change.stockDelta = stock - original.stock;
        }
      }

      const sell = formData.get(`sell-${id}`) === 'on';
      if (sell !== original.sell) change.sellOnline = sell;
      const show = formData.get(`show-${id}`) === 'on';
      if (show !== original.show) change.showOnSite = show;
      changes.push(change);
    }
    if (problems.length > 0) {
      return { ok: false, message: `Corrija antes de salvar: ${problems.slice(0, 4).join(' ')}${problems.length > 4 ? ` (e mais ${problems.length - 4})` : ''}` };
    }

    const effective = changes.filter((change) => Object.keys(change).length > 1);
    if (effective.length === 0) return { ok: true, message: 'Nenhuma alteração para salvar.' };
    if (effective.some((change) => change.stockDelta)) await requireActionPermission('products.stock');

    const result = await bulkUpdateStoreProducts(effective, toActor(user));
    invalidateSiteCache();
    revalidatePath('/sistema', 'layout');
    return { ok: true, message: `${result.ids.length} ${result.ids.length === 1 ? 'produto atualizado' : 'produtos atualizados'}.` };
  });
}

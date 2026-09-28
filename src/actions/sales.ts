'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { ActionState } from '@/lib/action-state';
import { formatSaleCode } from '@/lib/codes';
import { idField } from '@/lib/validation/common';
import { parseOrderPayload } from '@/lib/validation/orders';
import { paymentSchema } from '@/lib/validation/payments';
import { cancelSaleSchema, saleSchema } from '@/lib/validation/sales';
import { PermissionError } from '@/server/auth/errors';
import { requireActionPermission } from '@/server/auth/session';
import { hasPermission, toActor } from '@/server/auth/types';
import { setFlash } from '@/server/flash';
import { registerPayment } from '@/server/services/payments';
import { cancelSale, createSale, getSaleDetail } from '@/server/services/sales';
import { formToObject, runAction, validationFailure } from './_helpers';

export async function createSaleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('sales.create');
    const parsed = saleSchema.safeParse({ ...formToObject(formData), items: parseOrderPayload(formData.get('items')) });
    if (!parsed.success) return validationFailure(parsed.error, formData);
    if (parsed.data.payNow && !hasPermission(user, 'payments.create')) throw new PermissionError('Você não tem permissão para registrar pagamentos.');

    const sale = await createSale(
      {
        customerId: parsed.data.customerId,
        saleDate: parsed.data.saleDate,
        discountCents: parsed.data.discountCents,
        notes: parsed.data.notes,
        items: parsed.data.items,
        payment: parsed.data.payNow && parsed.data.paymentMethod ? { method: parsed.data.paymentMethod } : null,
      },
      toActor(user),
    );
    await setFlash('success', `Venda ${formatSaleCode(sale.number)} registrada.`);
    // "Imprimir ao registrar": abre direto o comprovante A4 com a janela de impressão (quem não pode imprimir vai para a venda).
    const print = formData.get('print') === '1' && hasPermission(user, 'documents.print') && hasPermission(user, 'sales.view');
    redirect(print ? `/imprimir/venda/${sale.id}?auto=1` : `/sistema/vendas/${sale.id}`);
  });
}

export async function cancelSaleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('sales.cancel');
    const id = idField('Venda').safeParse(formData.get('id'));
    if (!id.success) return { ok: false, message: 'Venda inválida.' };
    const parsed = cancelSaleSchema.safeParse(formToObject(formData));
    const reason = parsed.success ? parsed.data.reason : null;
    const detail = await getSaleDetail(id.data);
    await cancelSale(id.data, reason, toActor(user));
    await setFlash('success', `Venda ${detail ? formatSaleCode(detail.sale.number) : ''} cancelada.`);
    redirect(`/sistema/vendas/${id.data}`);
  });
}

export async function registerSalePaymentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('payments.create');
    const id = idField('Venda').safeParse(formData.get('id'));
    if (!id.success) return { ok: false, message: 'Venda inválida.' };
    const parsed = paymentSchema.safeParse(formToObject(formData));
    if (!parsed.success) return validationFailure(parsed.error, formData);
    await registerPayment({ ...parsed.data, saleId: id.data }, toActor(user));
    revalidatePath('/sistema', 'layout');
    return { ok: true, message: 'Pagamento registrado.' };
  });
}

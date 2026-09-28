'use server';

import { revalidatePath } from 'next/cache';
import type { ActionState } from '@/lib/action-state';
import { formatStoreOrderCode } from '@/lib/codes';
import { parseCartField } from '@/lib/store-cart';
import { idField } from '@/lib/validation/common';
import { checkoutSchema, storeCancelSchema, storeNoteSchema, storeSettingsSchema, storeStatusSchema } from '@/lib/validation/store';
import { PermissionError } from '@/server/auth/errors';
import { getClientIp, requireActionPermission } from '@/server/auth/session';
import { hasPermission, toActor } from '@/server/auth/types';
import { invalidateSiteCache } from '@/server/services/site';
import {
  addStoreOrderNote,
  cancelStoreOrder,
  changeStoreOrderStatus,
  confirmStorePayment,
  getStoreOrderDetail,
  placeStoreOrder,
} from '@/server/services/store-orders';
import { getStoreSettings, updateStoreSettings } from '@/server/services/store-settings';
import { formToObject, runAction, validationFailure } from './_helpers';

// ---------------------------------------------------------------------------
// Checkout público (sem login)
// ---------------------------------------------------------------------------

/** Tempo mínimo entre abrir o checkout e enviar: robôs que postam direto não esperam. */
const MIN_FILL_MS = 2500;

/** Em caso de sucesso devolve `data: { url }` (página de acompanhamento); o navegador limpa o carrinho e navega. */
export async function placeOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    // Anti-robô: campo-isca invisível e tempo mínimo de preenchimento.
    if (String(formData.get('website') ?? '').trim() !== '') return { ok: false, message: 'Não foi possível enviar o pedido. Recarregue a página e tente de novo.' };
    const startedAt = Number(formData.get('startedAt'));
    if (!Number.isFinite(startedAt) || Date.now() - startedAt < MIN_FILL_MS) {
      return { ok: false, message: 'Confira os dados do pedido e envie novamente.' };
    }

    const parsed = checkoutSchema.safeParse(formToObject(formData));
    if (!parsed.success) return validationFailure(parsed.error, formData);
    const items = parseCartField(formData.get('items'));
    if (items.length === 0) return { ok: false, message: 'Seu carrinho está vazio.' };

    const config = await getStoreSettings();
    if (config.policyText && !parsed.data.acceptTerms) {
      return { ok: false, message: 'Corrija os campos destacados.', fieldErrors: { acceptTerms: 'Confirme que leu as condições da loja.' }, values: {} };
    }

    const data = parsed.data;
    const placed = await placeStoreOrder(
      {
        items: items.map((item) => ({ productId: item.id, quantity: item.qty })),
        buyer: { name: data.name, phone: data.phone, email: data.email },
        fulfillment: data.fulfillment,
        address:
          data.fulfillment === 'DELIVERY'
            ? {
                zip: data.zip!.replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2'),
                street: data.street!,
                number: data.number!,
                complement: data.complement,
                district: data.district!,
                city: data.city!,
                state: data.state!.toUpperCase(),
              }
            : null,
        paymentMethod: data.paymentMethod,
        notes: data.notes,
      },
      { ip: await getClientIp() },
    );
    revalidatePath('/sistema', 'layout');
    return { ok: true, message: `Pedido ${formatStoreOrderCode(placed.number)} enviado!`, data: { url: `/loja/pedido/${placed.token}?novo=1` } };
  });
}

// ---------------------------------------------------------------------------
// Atendimento (sistema)
// ---------------------------------------------------------------------------

export async function changeStoreOrderStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('store.manage');
    const id = idField('Pedido').safeParse(formData.get('id'));
    if (!id.success) return { ok: false, message: 'Pedido inválido.' };
    const parsed = storeStatusSchema.safeParse(formToObject(formData));
    if (!parsed.success) return validationFailure(parsed.error, formData);
    const method = parsed.data.paymentMethod as 'DINHEIRO' | 'PIX' | 'CARTAO' | 'BOLETO' | null;
    if (method && !hasPermission(user, 'payments.create')) throw new PermissionError('Você não tem permissão para registrar pagamentos.');
    const order = await changeStoreOrderStatus(id.data, parsed.data.status, toActor(user), { paymentMethod: method });
    revalidatePath('/sistema', 'layout');
    return { ok: true, message: `Pedido ${formatStoreOrderCode(order.number)} atualizado.` };
  });
}

export async function confirmStorePaymentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('store.manage', 'payments.create');
    const id = idField('Pedido').safeParse(formData.get('id'));
    if (!id.success) return { ok: false, message: 'Pedido inválido.' };
    const order = await confirmStorePayment(id.data, toActor(user), 'PIX');
    revalidatePath('/sistema', 'layout');
    return { ok: true, message: `Pagamento do pedido ${formatStoreOrderCode(order.number)} confirmado.` };
  });
}

export async function cancelStoreOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('store.manage');
    const id = idField('Pedido').safeParse(formData.get('id'));
    if (!id.success) return { ok: false, message: 'Pedido inválido.' };
    const detail = await getStoreOrderDetail(id.data);
    // Pedido já pago: cancelar estorna o pagamento, o que exige a mesma permissão de cancelar vendas.
    if (detail && detail.paidCents > 0 && !hasPermission(user, 'sales.cancel')) {
      throw new PermissionError('Este pedido já tem pagamento registrado. Peça a um administrador para cancelá-lo (o pagamento será estornado).');
    }
    const parsed = storeCancelSchema.safeParse(formToObject(formData));
    await cancelStoreOrder(id.data, parsed.success ? parsed.data.reason : null, toActor(user));
    revalidatePath('/sistema', 'layout');
    return { ok: true, message: `Pedido ${detail ? formatStoreOrderCode(detail.order.number) : ''} cancelado. Estoque devolvido.`.replace('  ', ' ') };
  });
}

export async function addStoreOrderNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('store.manage');
    const id = idField('Pedido').safeParse(formData.get('id'));
    if (!id.success) return { ok: false, message: 'Pedido inválido.' };
    const parsed = storeNoteSchema.safeParse(formToObject(formData));
    if (!parsed.success) return validationFailure(parsed.error, formData);
    await addStoreOrderNote(id.data, parsed.data.message, parsed.data.isPublic, toActor(user));
    revalidatePath('/sistema', 'layout');
    return { ok: true, message: parsed.data.isPublic ? 'Mensagem publicada no acompanhamento do cliente.' : 'Observação interna registrada.' };
  });
}

export async function updateStoreSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('settings.manage');
    const parsed = storeSettingsSchema.safeParse(formToObject(formData));
    if (!parsed.success) return validationFailure(parsed.error, formData);
    await updateStoreSettings(parsed.data, toActor(user));
    invalidateSiteCache();
    revalidatePath('/sistema', 'layout');
    return { ok: true, message: 'Configurações da loja virtual salvas.' };
  });
}

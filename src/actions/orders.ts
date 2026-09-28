'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { ActionState } from '@/lib/action-state';
import { formatOrderCode } from '@/lib/codes';
import { idField } from '@/lib/validation/common';
import { orderNoteSchema, orderSchema, parseOrderPayload, statusChangeSchema } from '@/lib/validation/orders';
import { paymentSchema, voidPaymentSchema } from '@/lib/validation/payments';
import { requireActionPermission } from '@/server/auth/session';
import { toActor } from '@/server/auth/types';
import { setFlash } from '@/server/flash';
import { addOrderNote, changeOrderStatus, createOrder, deleteOrder, getOrder, updateOrder } from '@/server/services/orders';
import { registerPayment, voidPayment } from '@/server/services/payments';
import { ORDER_STATUS } from '@/config/order-status';
import { formToObject, runAction, validationFailure } from './_helpers';

function orderRaw(formData: FormData) {
  return { ...formToObject(formData), items: parseOrderPayload(formData.get('items')) };
}

export async function createOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('orders.create');
    const parsed = orderSchema.safeParse(orderRaw(formData));
    if (!parsed.success) return validationFailure(parsed.error, formData);
    const order = await createOrder(parsed.data, toActor(user), { status: parsed.data.status });
    await setFlash('success', `Ordem ${formatOrderCode(order.number)} criada com sucesso.`);
    redirect(`/sistema/ordens/${order.id}`);
  });
}

export async function updateOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('orders.edit');
    const id = idField('Ordem').safeParse(formData.get('id'));
    if (!id.success) return { ok: false, message: 'Ordem inválida.' };
    const parsed = orderSchema.safeParse(orderRaw(formData));
    if (!parsed.success) return validationFailure(parsed.error, formData);
    const order = await updateOrder(id.data, parsed.data, toActor(user));
    await setFlash('success', `Ordem ${formatOrderCode(order.number)} atualizada.`);
    redirect(`/sistema/ordens/${order.id}`);
  });
}

export async function changeOrderStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('orders.status');
    const id = idField('Ordem').safeParse(formData.get('id'));
    if (!id.success) return { ok: false, message: 'Ordem inválida.' };
    const parsed = statusChangeSchema.safeParse(formToObject(formData));
    if (!parsed.success) return validationFailure(parsed.error, formData);
    const order = await changeOrderStatus(id.data, parsed.data.status, toActor(user), { note: parsed.data.note });
    revalidatePath('/sistema', 'layout');
    return { ok: true, message: `${formatOrderCode(order.number)}: status alterado para “${ORDER_STATUS[order.status].label}”.` };
  });
}

/** Cancelamento (com motivo) a partir do botão de confirmação. */
export async function cancelOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('orders.status');
    const id = idField('Ordem').safeParse(formData.get('id'));
    if (!id.success) return { ok: false, message: 'Ordem inválida.' };
    const reason = String(formData.get('reason') ?? '').trim().slice(0, 300) || null;
    const order = await changeOrderStatus(id.data, 'CANCELADO', toActor(user), { note: reason });
    await setFlash('success', `Ordem ${formatOrderCode(order.number)} cancelada.`);
    redirect(`/sistema/ordens/${order.id}`);
  });
}

export async function addOrderNoteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('orders.view');
    const id = idField('Ordem').safeParse(formData.get('id'));
    if (!id.success) return { ok: false, message: 'Ordem inválida.' };
    const parsed = orderNoteSchema.safeParse(formToObject(formData));
    if (!parsed.success) return validationFailure(parsed.error, formData);
    await addOrderNote(id.data, parsed.data.message, toActor(user));
    revalidatePath('/sistema', 'layout');
    return { ok: true, message: 'Comentário adicionado ao histórico.' };
  });
}

export async function deleteOrderAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('orders.delete');
    const id = idField('Ordem').safeParse(formData.get('id'));
    if (!id.success) return { ok: false, message: 'Ordem inválida.' };
    const order = await getOrder(id.data);
    await deleteOrder(id.data, toActor(user));
    await setFlash('success', `Ordem ${order ? formatOrderCode(order.number) : ''} excluída.`);
    redirect('/sistema/ordens');
  });
}

export async function registerOrderPaymentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('payments.create');
    const id = idField('Ordem').safeParse(formData.get('id'));
    if (!id.success) return { ok: false, message: 'Ordem inválida.' };
    const parsed = paymentSchema.safeParse(formToObject(formData));
    if (!parsed.success) return validationFailure(parsed.error, formData);
    await registerPayment({ ...parsed.data, orderId: id.data }, toActor(user));
    revalidatePath('/sistema', 'layout');
    return { ok: true, message: 'Pagamento registrado.' };
  });
}

export async function voidPaymentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('payments.void');
    const id = idField('Pagamento').safeParse(formData.get('id'));
    if (!id.success) return { ok: false, message: 'Pagamento inválido.' };
    const parsed = voidPaymentSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Informe o motivo.' };
    await voidPayment(id.data, parsed.data.reason, toActor(user));
    revalidatePath('/sistema', 'layout');
    return { ok: true, message: 'Pagamento estornado.' };
  });
}

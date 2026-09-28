'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { ActionState } from '@/lib/action-state';
import { idField } from '@/lib/validation/common';
import { expenseCategorySchema, expenseSchema } from '@/lib/validation/expenses';
import { standalonePaymentSchema } from '@/lib/validation/payments';
import { requireActionPermission } from '@/server/auth/session';
import { toActor } from '@/server/auth/types';
import { setFlash } from '@/server/flash';
import { createExpense, deleteExpense, deleteExpenseCategory, saveExpenseCategory, updateExpense } from '@/server/services/expenses';
import { registerPayment } from '@/server/services/payments';
import { formToObject, runAction, validationFailure } from './_helpers';

export async function createExpenseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('expenses.manage');
    const parsed = expenseSchema.safeParse(formToObject(formData));
    if (!parsed.success) return validationFailure(parsed.error, formData);
    await createExpense(parsed.data, toActor(user));
    await setFlash('success', 'Custo lançado.');
    redirect('/sistema/financeiro/custos');
  });
}

export async function updateExpenseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('expenses.manage');
    const id = idField('Custo').safeParse(formData.get('id'));
    if (!id.success) return { ok: false, message: 'Custo inválido.' };
    const parsed = expenseSchema.safeParse(formToObject(formData));
    if (!parsed.success) return validationFailure(parsed.error, formData);
    await updateExpense(id.data, parsed.data, toActor(user));
    await setFlash('success', 'Custo atualizado.');
    redirect('/sistema/financeiro/custos');
  });
}

export async function deleteExpenseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('expenses.manage');
    const id = idField('Custo').safeParse(formData.get('id'));
    if (!id.success) return { ok: false, message: 'Custo inválido.' };
    await deleteExpense(id.data, toActor(user));
    await setFlash('success', 'Custo excluído.');
    redirect('/sistema/financeiro/custos');
  });
}

export async function saveExpenseCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('expenses.manage');
    const parsed = expenseCategorySchema.safeParse(formToObject(formData));
    if (!parsed.success) return validationFailure(parsed.error, formData);
    const rawId = formData.get('id');
    const id = rawId ? idField('Categoria').safeParse(rawId) : null;
    await saveExpenseCategory({ id: id?.success ? id.data : undefined, name: parsed.data.name, isGoods: parsed.data.isGoods }, toActor(user));
    revalidatePath('/sistema', 'layout');
    return { ok: true, message: 'Categoria salva.' };
  });
}

export async function deleteExpenseCategoryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('expenses.manage');
    const id = idField('Categoria').safeParse(formData.get('id'));
    if (!id.success) return { ok: false, message: 'Categoria inválida.' };
    await deleteExpenseCategory(id.data, toActor(user));
    revalidatePath('/sistema', 'layout');
    return { ok: true, message: 'Categoria excluída.' };
  });
}

/** Entrada avulsa (sem OS/venda), ex.: serviço externo ou venda sem cadastro. */
export async function createStandalonePaymentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('payments.create');
    const parsed = standalonePaymentSchema.safeParse(formToObject(formData));
    if (!parsed.success) return validationFailure(parsed.error, formData);
    await registerPayment(
      { amountCents: parsed.data.amountCents, method: parsed.data.method, paidDate: parsed.data.paidDate, description: parsed.data.description, customerId: parsed.data.customerId, notes: parsed.data.notes },
      toActor(user),
    );
    await setFlash('success', 'Entrada registrada.');
    redirect('/sistema/financeiro/entradas');
  });
}

'use server';

import { redirect } from 'next/navigation';
import type { ActionState } from '@/lib/action-state';
import { formValues, idField } from '@/lib/validation/common';
import { customerSchema, type CustomerFormInput } from '@/lib/validation/customers';
import { toActor } from '@/server/auth/types';
import { requireActionPermission } from '@/server/auth/session';
import { setFlash } from '@/server/flash';
import {
  createCustomer,
  deleteCustomer,
  findCustomersByPhone,
  updateCustomer,
  type CustomerData,
} from '@/server/services/customers';
import { formToObject, runAction, validationFailure } from './_helpers';

function toCustomerData(input: CustomerFormInput): CustomerData {
  return {
    name: input.name,
    phone: input.phone,
    whatsapp: input.whatsappSame ? input.phone : input.whatsapp,
    document: input.document,
    email: input.email,
    address: input.address,
    notes: input.notes,
  };
}

/** Só aceita retorno para páginas internas do sistema. */
function safeReturnTo(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null;
  return value.startsWith('/sistema') && !value.includes('//') && !value.includes('\\') ? value : null;
}

function duplicateState(formData: FormData, name: string): ActionState {
  return {
    ok: false,
    message: `Já existe um cliente com este telefone: ${name}. Se for outra pessoa, marque "Cadastrar mesmo assim" e salve novamente.`,
    fieldErrors: { phone: 'Telefone já cadastrado.' },
    values: formValues(formData),
    data: { duplicate: true },
  };
}

export async function createCustomerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('customers.create');
    const parsed = customerSchema.safeParse(formToObject(formData));
    if (!parsed.success) return validationFailure(parsed.error, formData);

    const data = toCustomerData(parsed.data);
    if (!parsed.data.allowDuplicate) {
      const duplicates = await findCustomersByPhone([data.phone, data.whatsapp]);
      if (duplicates.length) return duplicateState(formData, duplicates[0]!.name);
    }

    const created = await createCustomer(data, toActor(user));
    await setFlash('success', `Cliente "${created.name}" cadastrado com sucesso.`);
    const returnTo = safeReturnTo(formData.get('returnTo'));
    redirect(returnTo ? `${returnTo}${returnTo.includes('?') ? '&' : '?'}clienteId=${created.id}` : `/sistema/clientes/${created.id}`);
  });
}

export async function updateCustomerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('customers.edit');
    const id = idField('Cliente').safeParse(formData.get('id'));
    if (!id.success) return { ok: false, message: 'Cliente inválido.' };
    const parsed = customerSchema.safeParse(formToObject(formData));
    if (!parsed.success) return validationFailure(parsed.error, formData);

    const data = toCustomerData(parsed.data);
    if (!parsed.data.allowDuplicate) {
      const duplicates = await findCustomersByPhone([data.phone, data.whatsapp], id.data);
      if (duplicates.length) return duplicateState(formData, duplicates[0]!.name);
    }

    await updateCustomer(id.data, data, toActor(user));
    await setFlash('success', 'Cadastro do cliente atualizado.');
    redirect(`/sistema/clientes/${id.data}`);
  });
}

export async function deleteCustomerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('customers.delete');
    const id = idField('Cliente').safeParse(formData.get('id'));
    if (!id.success) return { ok: false, message: 'Cliente inválido.' };
    await deleteCustomer(id.data, toActor(user));
    await setFlash('success', 'Cliente excluído.');
    redirect('/sistema/clientes');
  });
}

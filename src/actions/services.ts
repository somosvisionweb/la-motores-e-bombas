'use server';

import { redirect } from 'next/navigation';
import type { ActionState } from '@/lib/action-state';
import { idField } from '@/lib/validation/common';
import { serviceSchema } from '@/lib/validation/catalog';
import { toActor } from '@/server/auth/types';
import { requireActionPermission } from '@/server/auth/session';
import { setFlash } from '@/server/flash';
import { createService, deleteService, updateService } from '@/server/services/catalog-services';
import { invalidateSiteCache } from '@/server/services/site';
import { formToObject, runAction, validationFailure } from './_helpers';

export async function createServiceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('services.manage');
    const parsed = serviceSchema.safeParse(formToObject(formData));
    if (!parsed.success) return validationFailure(parsed.error, formData);
    const service = await createService(parsed.data, toActor(user));
    invalidateSiteCache();
    await setFlash('success', `Serviço "${service.name}" cadastrado.`);
    redirect('/sistema/servicos');
  });
}

export async function updateServiceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('services.manage');
    const id = idField('Serviço').safeParse(formData.get('id'));
    if (!id.success) return { ok: false, message: 'Serviço inválido.' };
    const parsed = serviceSchema.safeParse(formToObject(formData));
    if (!parsed.success) return validationFailure(parsed.error, formData);
    await updateService(id.data, parsed.data, toActor(user));
    invalidateSiteCache();
    await setFlash('success', 'Serviço atualizado.');
    redirect('/sistema/servicos');
  });
}

export async function deleteServiceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('services.manage');
    const id = idField('Serviço').safeParse(formData.get('id'));
    if (!id.success) return { ok: false, message: 'Serviço inválido.' };
    await deleteService(id.data, toActor(user));
    invalidateSiteCache();
    await setFlash('success', 'Serviço excluído.');
    redirect('/sistema/servicos');
  });
}

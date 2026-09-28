'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { ActionState } from '@/lib/action-state';
import { idField } from '@/lib/validation/common';
import { roleSchema, userSchema } from '@/lib/validation/users';
import { requireActionPermission } from '@/server/auth/session';
import { toActor } from '@/server/auth/types';
import { setFlash } from '@/server/flash';
import { createUser, deleteRole, resetUserPassword, saveRole, updateUser } from '@/server/services/users';
import { formToObject, runAction, validationFailure } from './_helpers';

export interface CredentialsData {
  username: string;
  name: string;
  temporaryPassword: string;
}

/** Cria o usuário e devolve a senha temporária UMA vez (não é gravada em texto em nenhum lugar). */
export async function createUserAction(_prev: ActionState<CredentialsData>, formData: FormData): Promise<ActionState<CredentialsData>> {
  return runAction<CredentialsData>(async () => {
    const user = await requireActionPermission('users.manage');
    const parsed = userSchema.safeParse(formToObject(formData));
    if (!parsed.success) return validationFailure(parsed.error, formData) as ActionState<CredentialsData>;
    const { user: created, temporaryPassword } = await createUser(parsed.data, toActor(user));
    revalidatePath('/sistema/usuarios');
    return { ok: true, message: `Usuário “${created.username}” criado.`, data: { username: created.username, name: created.name, temporaryPassword } };
  });
}

export async function updateUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('users.manage');
    const id = idField('Usuário').safeParse(formData.get('id'));
    if (!id.success) return { ok: false, message: 'Usuário inválido.' };
    const parsed = userSchema.omit({ username: true }).safeParse(formToObject(formData));
    if (!parsed.success) return validationFailure(parsed.error, formData);
    await updateUser(id.data, parsed.data, toActor(user));
    await setFlash('success', 'Usuário atualizado.');
    redirect('/sistema/usuarios');
  });
}

export async function resetPasswordAction(_prev: ActionState<CredentialsData>, formData: FormData): Promise<ActionState<CredentialsData>> {
  return runAction<CredentialsData>(async () => {
    const user = await requireActionPermission('users.manage');
    const id = idField('Usuário').safeParse(formData.get('id'));
    if (!id.success) return { ok: false, message: 'Usuário inválido.' };
    const temporaryPassword = await resetUserPassword(id.data, toActor(user));
    return { ok: true, message: 'Senha redefinida. Anote a nova senha temporária.', data: { username: String(formData.get('username') ?? ''), name: String(formData.get('name') ?? ''), temporaryPassword } };
  });
}

export async function saveRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('users.manage');
    const parsed = roleSchema.safeParse(formToObject(formData));
    if (!parsed.success) return validationFailure(parsed.error, formData);
    const rawId = formData.get('id');
    const id = rawId ? idField('Perfil').safeParse(rawId) : null;
    await saveRole({ ...parsed.data, id: id?.success ? id.data : undefined }, toActor(user));
    await setFlash('success', 'Perfil de acesso salvo.');
    redirect('/sistema/usuarios/perfis');
  });
}

export async function deleteRoleAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireActionPermission('users.manage');
    const id = idField('Perfil').safeParse(formData.get('id'));
    if (!id.success) return { ok: false, message: 'Perfil inválido.' };
    await deleteRole(id.data, toActor(user));
    await setFlash('success', 'Perfil excluído.');
    redirect('/sistema/usuarios/perfis');
  });
}

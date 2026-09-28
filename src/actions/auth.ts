'use server';

import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import type { ActionState } from '@/lib/action-state';
import { changePasswordSchema, loginSchema, sanitizeNextPath } from '@/lib/validation/auth';
import { hashPassword, validatePasswordStrength, verifyDummyPassword, verifyPassword } from '@/server/auth/password';
import {
  createSession,
  destroyCurrentSession,
  destroyUserSessions,
  getClientIp,
  requireUserAllowingPasswordChange,
} from '@/server/auth/session';
import { checkLoginThrottle, recordLoginAttempt } from '@/server/auth/throttle';
import { getDb, runWrite } from '@/server/db/client';
import { users } from '@/server/db/schema';
import { audit } from '@/server/services/audit';
import { setFlash } from '@/server/flash';
import { formToObject, runAction, validationFailure } from './_helpers';

const GENERIC_LOGIN_ERROR = 'Usuário ou senha incorretos.';

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { ...validationFailure(parsed.error, formData), values: { username: String(formData.get('username') ?? '') } };

  const { username, password, next } = parsed.data;
  const ip = await getClientIp();
  const keepValues = { username: String(formData.get('username') ?? '') };

  const throttle = await checkLoginThrottle(username, ip);
  if (throttle.blocked) {
    return {
      ok: false,
      message: `Muitas tentativas de acesso. Por segurança, aguarde ${throttle.retryAfterMinutes} minutos e tente novamente.`,
      values: keepValues,
    };
  }

  const [user] = await getDb().select().from(users).where(eq(users.username, username)).limit(1);
  if (!user || !user.isActive) {
    await verifyDummyPassword(password); // iguala o tempo de resposta (não revela se o usuário existe)
    await recordLoginAttempt(username, ip, false);
    return { ok: false, message: GENERIC_LOGIN_ERROR, values: keepValues };
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    await recordLoginAttempt(username, ip, false);
    return { ok: false, message: GENERIC_LOGIN_ERROR, values: keepValues };
  }

  await recordLoginAttempt(username, ip, true);
  await createSession(user.id);
  await runWrite((tx) => tx.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id)));
  await audit({ actor: { id: user.id, name: user.name, ip }, action: 'LOGIN', entityType: 'users', entityId: user.id, summary: 'Login realizado' });

  redirect(user.mustChangePassword ? '/trocar-senha' : sanitizeNextPath(next));
}

export async function logoutAction(): Promise<void> {
  await destroyCurrentSession();
  redirect('/login');
}

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction(async () => {
    const sessionUser = await requireUserAllowingPasswordChange();
    const parsed = changePasswordSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { ...validationFailure(parsed.error, formData), values: {} };

    const { currentPassword, newPassword } = parsed.data;
    const [user] = await getDb().select().from(users).where(eq(users.id, sessionUser.id)).limit(1);
    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      return { ok: false, message: 'A senha atual está incorreta.', fieldErrors: { currentPassword: 'Senha atual incorreta.' }, values: {} };
    }
    if (newPassword === currentPassword) {
      return { ok: false, message: 'A nova senha deve ser diferente da atual.', fieldErrors: { newPassword: 'Escolha uma senha diferente da atual.' }, values: {} };
    }
    const weak = validatePasswordStrength(newPassword, { username: user.username });
    if (weak) return { ok: false, message: weak, fieldErrors: { newPassword: weak }, values: {} };

    const passwordHash = await hashPassword(newPassword);
    await runWrite((tx) =>
      tx.update(users).set({ passwordHash, mustChangePassword: false, passwordChangedAt: new Date() }).where(eq(users.id, user.id)),
    );
    await destroyUserSessions(user.id, sessionUser.sessionId); // encerra os demais dispositivos
    await audit({ actor: { id: user.id, name: user.name, ip: sessionUser.ip }, action: 'PASSWORD_CHANGE', entityType: 'users', entityId: user.id, summary: 'Senha alterada pelo próprio usuário' });

    await setFlash('success', 'Senha alterada com sucesso.');
    redirect('/sistema');
  });
}

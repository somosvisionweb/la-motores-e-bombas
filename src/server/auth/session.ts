/**
 * Sessões: cookie HttpOnly com token aleatório de 256 bits. Só o SHA-256 do token vai para o banco,
 * então um vazamento do banco não permite reutilizar sessões.
 * Validade: expira por inatividade (`SESSION_IDLE_HOURS`, padrão 12h) e no máximo em `SESSION_MAX_DAYS` (padrão 7 dias).
 */
import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq, lt } from 'drizzle-orm';
import { ALL_PERMISSIONS } from '@/config/permissions';
import { getDb, runWrite } from '../db/client';
import { roles, sessions, users } from '../db/schema';
import { hasPermission, type PermissionKey, type SessionUser } from './types';
import { PermissionError } from './errors';

export const SESSION_COOKIE = 'la_session';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const idleMs = () => Number(process.env.SESSION_IDLE_HOURS || 12) * HOUR;
const maxMs = () => Number(process.env.SESSION_MAX_DAYS || 7) * DAY;
const REFRESH_AFTER_MS = 5 * 60 * 1000;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export async function getClientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim() || null;
  return h.get('x-real-ip');
}

/** Cria a sessão, grava o cookie e limpa sessões expiradas. */
export async function createSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString('base64url');
  const h = await headers();
  const ip = await getClientIp();
  const userAgent = h.get('user-agent')?.slice(0, 300) ?? null;
  const now = Date.now();

  await runWrite(async (tx) => {
    await tx.delete(sessions).where(lt(sessions.expiresAt, new Date(now)));
    await tx.insert(sessions).values({
      id: sha256(token),
      userId,
      ip,
      userAgent,
      expiresAt: new Date(now + idleMs()),
    });
  });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(maxMs() / 1000),
  });
}

export async function destroyCurrentSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await runWrite((tx) => tx.delete(sessions).where(eq(sessions.id, sha256(token))));
  }
  jar.delete(SESSION_COOKIE);
}

/** Encerra todas as sessões de um usuário (exceto, opcionalmente, a atual). */
export async function destroyUserSessions(userId: number, exceptSessionId?: string): Promise<void> {
  await runWrite(async (tx) => {
    if (exceptSessionId) {
      const rows = await tx.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, userId));
      for (const row of rows) if (row.id !== exceptSessionId) await tx.delete(sessions).where(eq(sessions.id, row.id));
    } else {
      await tx.delete(sessions).where(eq(sessions.userId, userId));
    }
  });
}

/** Usuário da sessão atual (ou null). Validado no servidor a cada requisição. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length < 20 || token.length > 100) return null;

  const id = sha256(token);
  const [row] = await getDb()
    .select({ session: sessions, user: users, role: roles })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(roles, eq(roles.id, users.roleId))
    .where(eq(sessions.id, id))
    .limit(1);
  if (!row) return null;

  const now = Date.now();
  const expired =
    row.session.expiresAt.getTime() < now || row.session.createdAt.getTime() + maxMs() < now || !row.user.isActive;
  if (expired) {
    await runWrite((tx) => tx.delete(sessions).where(eq(sessions.id, id)));
    return null;
  }

  // Renovação deslizante (no máximo uma escrita a cada 5 minutos).
  if (now - row.session.lastSeenAt.getTime() > REFRESH_AFTER_MS) {
    await runWrite((tx) =>
      tx
        .update(sessions)
        .set({ lastSeenAt: new Date(now), expiresAt: new Date(now + idleMs()) })
        .where(and(eq(sessions.id, id))),
    );
  }

  return {
    id: row.user.id,
    name: row.user.name,
    username: row.user.username,
    roleId: row.role.id,
    roleKey: row.role.key,
    roleName: row.role.name,
    // O perfil "admin" sempre tem acesso total, mesmo que uma permissão nova ainda não esteja gravada no perfil.
    permissions: row.role.key === 'admin' ? [...ALL_PERMISSIONS] : row.role.permissions,
    mustChangePassword: row.user.mustChangePassword,
    sessionId: id,
    ip: await getClientIp(),
  };
});

/** Exige login; redireciona para /login e, se a troca de senha for obrigatória, para /trocar-senha. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.mustChangePassword) redirect('/trocar-senha');
  return user;
}

/** Como `requireUser`, mas permite a tela de troca obrigatória de senha. */
export async function requireUserAllowingPasswordChange(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return user;
}

/** Para PÁGINAS: sem permissão → tela "acesso negado". */
export async function requirePagePermission(...permissions: PermissionKey[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!permissions.every((p) => hasPermission(user, p))) redirect('/sistema/acesso-negado');
  return user;
}

/** Para AÇÕES e rotas de API: sem sessão/permissão → lança erro tratado pelo chamador. */
export async function requireActionPermission(...permissions: PermissionKey[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || user.mustChangePassword) throw new PermissionError('Sua sessão expirou. Entre novamente.');
  if (!permissions.every((p) => hasPermission(user, p))) throw new PermissionError();
  return user;
}

/** Variante "qualquer uma das permissões". */
export async function requireAnyActionPermission(...permissions: PermissionKey[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || user.mustChangePassword) throw new PermissionError('Sua sessão expirou. Entre novamente.');
  if (!permissions.some((p) => hasPermission(user, p))) throw new PermissionError();
  return user;
}

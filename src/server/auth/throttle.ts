/**
 * Proteção contra força bruta no login: após 5 falhas do mesmo usuário (ou 30 do mesmo IP)
 * em 15 minutos o acesso é bloqueado temporariamente. O contador do usuário zera após um login bem-sucedido.
 */
import { and, count, desc, eq, gt } from 'drizzle-orm';
import { getDb, runWrite } from '../db/client';
import { loginAttempts } from '../db/schema';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES_PER_USER = 5;
const MAX_FAILURES_PER_IP = 30;

export interface ThrottleResult {
  blocked: boolean;
  retryAfterMinutes: number;
}

export async function checkLoginThrottle(username: string, ip: string | null): Promise<ThrottleResult> {
  const db = getDb();
  const since = new Date(Date.now() - WINDOW_MS);

  // Só conta falhas posteriores ao último login bem-sucedido do usuário.
  const [lastSuccess] = await db
    .select({ createdAt: loginAttempts.createdAt })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.username, username), eq(loginAttempts.success, true)))
    .orderBy(desc(loginAttempts.createdAt))
    .limit(1);
  const from = lastSuccess && lastSuccess.createdAt > since ? lastSuccess.createdAt : since;

  const [userFailures] = await db
    .select({ n: count() })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.username, username), eq(loginAttempts.success, false), gt(loginAttempts.createdAt, from)));

  let ipFailures = 0;
  if (ip) {
    const [row] = await db
      .select({ n: count() })
      .from(loginAttempts)
      .where(and(eq(loginAttempts.ip, ip), eq(loginAttempts.success, false), gt(loginAttempts.createdAt, since)));
    ipFailures = row?.n ?? 0;
  }

  const blocked = (userFailures?.n ?? 0) >= MAX_FAILURES_PER_USER || ipFailures >= MAX_FAILURES_PER_IP;
  return { blocked, retryAfterMinutes: Math.ceil(WINDOW_MS / 60000) };
}

export async function recordLoginAttempt(username: string, ip: string | null, success: boolean): Promise<void> {
  await runWrite(async (tx) => {
    await tx.insert(loginAttempts).values({ username, ip, success });
  });
}

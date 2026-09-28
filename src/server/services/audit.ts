import { AsyncLocalStorage } from 'node:async_hooks';
import { desc, eq, and } from 'drizzle-orm';
import { getDb, runWrite } from '../db/client';
import { auditLogs } from '../db/schema';
import type { Actor } from '../auth/types';

export interface AuditInput {
  actor?: Actor | null;
  action: string;
  entityType?: string;
  entityId?: number | null;
  summary?: string;
  data?: Record<string, unknown>;
  /** IP de quem originou a ação quando não há usuário logado (ex.: pedido feito na loja virtual). */
  ip?: string | null;
}

const silenced = new AsyncLocalStorage<true>();

/** Executa `fn` sem gravar auditoria (carga de dados de demonstração: não são ações reais de ninguém). */
export function withoutAudit<T>(fn: () => Promise<T>): Promise<T> {
  return silenced.run(true, fn);
}

/** Registra uma operação na trilha de auditoria. Dentro de outra transação, participa dela. */
export async function audit(input: AuditInput): Promise<void> {
  if (silenced.getStore()) return;
  await runWrite(async (tx) => {
    await tx.insert(auditLogs).values({
      userId: input.actor?.id ?? null,
      userName: input.actor?.name ?? null,
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      summary: input.summary ?? null,
      data: input.data ?? null,
      ip: input.actor?.ip ?? input.ip ?? null,
    });
  });
}

export async function listAuditLogs(options: { entityType?: string; entityId?: number; limit?: number } = {}) {
  const conditions = [];
  if (options.entityType) conditions.push(eq(auditLogs.entityType, options.entityType));
  if (options.entityId !== undefined) conditions.push(eq(auditLogs.entityId, options.entityId));
  return getDb()
    .select()
    .from(auditLogs)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(options.limit ?? 50);
}

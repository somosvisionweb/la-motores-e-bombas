/**
 * Links públicos (não adivinháveis) para compartilhar documentos com o cliente.
 * Token aleatório de 256 bits; pode ser revogado. O acesso público só baixa o PDF daquele documento.
 */
import { randomBytes } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Actor } from '../auth/types';
import { getDb, runWrite } from '../db/client';
import { documentLinks } from '../db/schema';
import { audit } from './audit';

export type DocumentLinkType = 'ORDER' | 'SALE' | 'RECEIPT';

/** Devolve o link ativo do documento (ou cria um novo). */
export async function getOrCreateShareToken(type: DocumentLinkType, refId: number, actor: Actor): Promise<string> {
  const [existing] = await getDb()
    .select()
    .from(documentLinks)
    .where(and(eq(documentLinks.type, type), eq(documentLinks.refId, refId), isNull(documentLinks.revokedAt)))
    .orderBy(desc(documentLinks.id))
    .limit(1);
  if (existing) return existing.token;

  const token = randomBytes(32).toString('base64url');
  await runWrite(async (tx) => {
    await tx.insert(documentLinks).values({ token, type, refId, createdBy: actor.id });
    await audit({ actor, action: 'DOCUMENT_LINK_CREATE', entityType: 'document_links', summary: `Link de compartilhamento criado (${type} #${refId})` });
  });
  return token;
}

export async function revokeShareLinks(type: DocumentLinkType, refId: number, actor: Actor): Promise<void> {
  await runWrite(async (tx) => {
    await tx
      .update(documentLinks)
      .set({ revokedAt: new Date() })
      .where(and(eq(documentLinks.type, type), eq(documentLinks.refId, refId), isNull(documentLinks.revokedAt)));
    await audit({ actor, action: 'DOCUMENT_LINK_REVOKE', entityType: 'document_links', summary: `Links revogados (${type} #${refId})` });
  });
}

/** Resolve o token de um link público válido (não revogado nem expirado) e registra o acesso. */
export async function resolveShareToken(token: string): Promise<{ type: DocumentLinkType; refId: number } | null> {
  if (!/^[A-Za-z0-9_-]{30,64}$/.test(token)) return null;
  const [link] = await getDb().select().from(documentLinks).where(eq(documentLinks.token, token)).limit(1);
  if (!link || link.revokedAt) return null;
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) return null;
  await runWrite(async (tx) => {
    await tx
      .update(documentLinks)
      .set({ lastAccessAt: new Date(), accessCount: link.accessCount + 1 })
      .where(eq(documentLinks.id, link.id));
  });
  return { type: link.type, refId: link.refId };
}

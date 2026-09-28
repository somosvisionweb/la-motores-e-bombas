import { and, asc, eq, sql } from 'drizzle-orm';
import type { ServiceFormInput } from '@/lib/validation/catalog';
import { BusinessError, NotFoundError } from '../auth/errors';
import type { Actor } from '../auth/types';
import { getDb, isUniqueViolation, runWrite } from '../db/client';
import { serviceOrderItems, services, type Service } from '../db/schema';
import { audit } from './audit';
import { allOf, likeAllTokens } from './query-utils';
import { serviceSearchText } from './search-text';

/** Catálogo de SERVIÇOS oferecidos (não confundir com serviços de uma OS, que são itens da ordem). */
export async function listServices(params: { q?: string; category?: string; activeOnly?: boolean } = {}): Promise<Service[]> {
  return getDb()
    .select()
    .from(services)
    .where(
      allOf(
        likeAllTokens(services.searchText, params.q),
        params.category ? eq(services.category, params.category) : undefined,
        params.activeOnly ? eq(services.isActive, true) : undefined,
      ),
    )
    .orderBy(asc(services.sortOrder), asc(sql`${services.name} COLLATE NOCASE`));
}

export async function getService(id: number): Promise<Service | null> {
  const [row] = await getDb().select().from(services).where(eq(services.id, id)).limit(1);
  return row ?? null;
}

export async function listServiceCategories(): Promise<string[]> {
  const rows = await getDb().selectDistinct({ category: services.category }).from(services).orderBy(asc(services.category));
  return rows.map((r) => r.category);
}

export async function searchServicesForSelect(q: string, limit = 8) {
  return getDb()
    .select({ id: services.id, name: services.name, defaultPriceCents: services.defaultPriceCents, category: services.category })
    .from(services)
    .where(allOf(eq(services.isActive, true), likeAllTokens(services.searchText, q)))
    .orderBy(asc(services.sortOrder), asc(sql`${services.name} COLLATE NOCASE`))
    .limit(limit);
}

export async function listSiteServices() {
  return getDb()
    .select({ id: services.id, name: services.name, category: services.category, description: services.description })
    .from(services)
    .where(and(eq(services.isActive, true), eq(services.showOnSite, true)))
    .orderBy(asc(services.sortOrder), asc(services.name));
}

function translate(error: unknown): unknown {
  if (isUniqueViolation(error)) return new BusinessError('Já existe um serviço com este nome.', 'name');
  return error;
}

export async function createService(input: ServiceFormInput, actor: Actor): Promise<Service> {
  try {
    return await runWrite(async (tx) => {
      const [created] = await tx
        .insert(services)
        .values({
          name: input.name,
          category: input.category,
          description: input.description,
          defaultPriceCents: input.defaultPriceCents,
          isActive: input.isActive,
          showOnSite: input.showOnSite,
          sortOrder: input.sortOrder,
          searchText: serviceSearchText(input),
        })
        .returning();
      await audit({ actor, action: 'SERVICE_CREATE', entityType: 'services', entityId: created!.id, summary: `Serviço cadastrado: ${created!.name}` });
      return created!;
    });
  } catch (error) {
    throw translate(error);
  }
}

export async function updateService(id: number, input: ServiceFormInput, actor: Actor): Promise<Service> {
  try {
    return await runWrite(async (tx) => {
      const [existing] = await tx.select().from(services).where(eq(services.id, id)).limit(1);
      if (!existing) throw new NotFoundError('Serviço');
      const [updated] = await tx
        .update(services)
        .set({
          name: input.name,
          category: input.category,
          description: input.description,
          defaultPriceCents: input.defaultPriceCents,
          isActive: input.isActive,
          showOnSite: input.showOnSite,
          sortOrder: input.sortOrder,
          searchText: serviceSearchText(input),
        })
        .where(eq(services.id, id))
        .returning();
      await audit({ actor, action: 'SERVICE_UPDATE', entityType: 'services', entityId: id, summary: `Serviço atualizado: ${input.name}` });
      return updated!;
    });
  } catch (error) {
    throw translate(error);
  }
}

/** Excluir não afeta ordens antigas (a descrição fica gravada na própria OS). Desativar é a alternativa reversível. */
export async function deleteService(id: number, actor: Actor): Promise<void> {
  await runWrite(async (tx) => {
    const [existing] = await tx.select().from(services).where(eq(services.id, id)).limit(1);
    if (!existing) throw new NotFoundError('Serviço');
    const [used] = await tx.select({ n: sql<number>`count(*)` }).from(serviceOrderItems).where(eq(serviceOrderItems.serviceId, id));
    await tx.delete(services).where(eq(services.id, id));
    await audit({
      actor,
      action: 'SERVICE_DELETE',
      entityType: 'services',
      entityId: id,
      summary: `Serviço excluído: ${existing.name}${Number(used?.n) ? ` (usado em ${used!.n} item(ns) de OS)` : ''}`,
    });
  });
}

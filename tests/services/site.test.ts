import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { products, services } from '@/server/db/schema';
import { getSiteBaseUrl, getSiteData, invalidateSiteCache } from '@/server/services/site';
import { setupTestDb, teardownTestDb } from '../helpers/db';

beforeAll(async () => {
  await setupTestDb('site');
});

beforeEach(() => invalidateSiteCache());

afterAll(() => {
  delete process.env.APP_URL;
  teardownTestDb();
});

describe('dados do site público', () => {
  it('traz os 19 serviços agrupados na ordem oficial e os 13 produtos', async () => {
    const site = await getSiteData();
    expect(site.serviceGroups.map((g) => g.name)).toEqual(['Principais', 'Motores', 'Bombas', 'Outros equipamentos']);
    expect(site.serviceGroups.map((g) => g.services.length)).toEqual([3, 4, 6, 6]);
    expect(site.serviceGroups.flatMap((g) => g.services)).toHaveLength(19);
    expect(site.products).toHaveLength(13);
    expect(site.heroImage).toBeNull();
    expect(site.gallery).toEqual([]);
    expect(site.company.name).toBe('LA Motores e Bombas');
  });

  it('itens ocultos do site (ou inativos) não aparecem; produtos novos aparecem sem preço inventado', async () => {
    await getDb().update(products).set({ showOnSite: false }).where(eq(products.name, 'Rotor'));
    await getDb().update(services).set({ isActive: false }).where(eq(services.name, 'Outros equipamentos'));
    const site = await getSiteData();
    expect(site.products.map((p) => p.name)).not.toContain('Rotor');
    expect(site.serviceGroups.find((g) => g.name === 'Outros equipamentos')!.services.map((s) => s.name)).not.toContain('Outros equipamentos');
    // o site só expõe nome/categoria/ícone/foto do produto: nenhum preço ou estoque
    expect(Object.keys(site.products[0]!).sort()).toEqual(['category', 'iconKey', 'id', 'imageFileId', 'name']);
  });

  it('usa cache curto: mudanças aparecem imediatamente após invalidar', async () => {
    const first = await getSiteData();
    await getDb().update(products).set({ name: 'Rolamentos (novo nome)' }).where(eq(products.name, 'Rolamentos'));
    expect(await getSiteData()).toBe(first); // ainda em cache
    invalidateSiteCache();
    const fresh = await getSiteData();
    expect(fresh).not.toBe(first);
    expect(fresh.products.map((p) => p.name)).toContain('Rolamentos (novo nome)');
  });
});

describe('endereço público do site', () => {
  it('prioriza o endereço configurado, depois APP_URL, e por fim o padrão de desenvolvimento', async () => {
    delete process.env.APP_URL;
    expect(await getSiteBaseUrl({ publicBaseUrl: 'https://www.lamotores.com.br/' })).toBe('https://www.lamotores.com.br');
    expect(await getSiteBaseUrl({ publicBaseUrl: null })).toBe('http://localhost:3000');
    process.env.APP_URL = 'https://app.exemplo.com.br///';
    expect(await getSiteBaseUrl({ publicBaseUrl: null })).toBe('https://app.exemplo.com.br');
    expect(await getSiteBaseUrl({ publicBaseUrl: '  ' })).toBe('https://app.exemplo.com.br');
  });
});

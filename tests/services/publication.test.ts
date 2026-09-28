import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { STORE_DEFAULTS } from '@/config/store';
import type { Actor } from '@/server/auth/types';
import { getDb } from '@/server/db/client';
import { auditLogs, products, users } from '@/server/db/schema';
import { clearDemoData } from '@/server/services/demo';
import { getSystemAlerts } from '@/server/services/notifications';
import { getPublicationChecklist, pendingRequiredSteps, type ChecklistItem, type PublicationChecklist } from '@/server/services/publication';
import { getCompanySettings, updateCompanyProfile, updatePrivacyPolicy } from '@/server/services/settings';
import { bulkUpdateStoreProducts } from '@/server/services/store-catalog';
import { updateStoreSettings } from '@/server/services/store-settings';
import { setupTestDb, teardownTestDb } from '../helpers/db';

let actor: Actor;
const previousAppUrl = process.env.APP_URL;
const TZ = 'America/Recife';
const DAY_MS = 86_400_000;

function item(checklist: PublicationChecklist, key: string): ChecklistItem {
  const found = checklist.items.find((entry) => entry.key === key);
  if (!found) throw new Error(`Item "${key}" não existe no checklist.`);
  return found;
}

async function statusOf(key: string) {
  return item(await getPublicationChecklist(), key).status;
}

async function setPublicUrl(url: string | null) {
  const c = await getCompanySettings();
  await updateCompanyProfile(
    { name: c.name, cnpj: c.cnpj, email: c.email, whatsapp: c.whatsapp, phone: c.phone, address: c.address, city: c.city, state: c.state, zip: c.zip, instagram: c.instagram, publicBaseUrl: url },
    actor,
  );
}

beforeAll(async () => {
  delete process.env.APP_URL; // o teste não pode depender do ambiente de quem roda
  ({ actor } = await setupTestDb('publication'));
});

afterAll(() => {
  if (previousAppUrl === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = previousAppUrl;
  teardownTestDb();
});

describe('instalação recém-criada (dados oficiais, nada mais)', () => {
  it('o que é da empresa já está pronto; o que só ela pode informar aparece como pendente', async () => {
    const checklist = await getPublicationChecklist();
    expect(item(checklist, 'company')).toMatchObject({ status: 'done', required: true });
    expect(item(checklist, 'demo')).toMatchObject({ status: 'done', required: true });
    expect(item(checklist, 'store-open')).toMatchObject({ status: 'done', required: false });

    // preço e estoque reais só a empresa tem: nada é inventado
    expect(item(checklist, 'products')).toMatchObject({ status: 'pending', required: true, href: '/sistema/loja/produtos' });
    expect(item(checklist, 'products').detail).toMatch(/Nenhum produto pode ser comprado ainda/);
    expect(item(checklist, 'pix').status).toBe('pending');
    expect(item(checklist, 'policy').status).toBe('pending');
    expect(item(checklist, 'privacy')).toMatchObject({ status: 'pending', required: false, href: '/sistema/configuracoes#privacidade' });
    expect(item(checklist, 'logo').status).toBe('pending');
    expect(item(checklist, 'photos').status).toBe('pending');
    expect(item(checklist, 'delivery').status).toBe('info');
    expect(item(checklist, 'search-console').status).toBe('info');

    // endereço público, HTTPS e senhas temporárias travam a publicação
    expect(item(checklist, 'public-url')).toMatchObject({ status: 'pending', required: true });
    expect(item(checklist, 'https')).toMatchObject({ status: 'pending', required: true });
    expect(item(checklist, 'passwords')).toMatchObject({ status: 'pending', required: true });
    expect(item(checklist, 'passwords').detail).toMatch(/Ewerton/);
    expect(item(checklist, 'backup').status).toBe('pending');
  });

  it('conta só os passos obrigatórios; o site ainda não está pronto', async () => {
    const checklist = await getPublicationChecklist();
    expect(checklist.requiredTotal).toBe(6); // empresa, produtos, demonstração, endereço público, HTTPS, senhas
    expect(checklist.requiredDone).toBe(2); // empresa e demonstração
    expect(checklist.ready).toBe(false);
    expect((await pendingRequiredSteps()).map((step) => step.key).sort()).toEqual(['https', 'passwords', 'products', 'public-url']);
  });

  it('o sino do administrador avisa quantos passos faltam (e só para quem gerencia as configurações)', async () => {
    const alerts = await getSystemAlerts({ permissions: ['settings.manage'] }, TZ);
    expect(alerts.find((alert) => alert.key === 'publication')).toMatchObject({
      tone: 'blue',
      count: 4,
      link: '/sistema/configuracoes/publicacao',
      title: 'Faltam 4 passos para publicar o site',
    });
    expect((await getSystemAlerts({ permissions: ['orders.view'] }, TZ)).find((alert) => alert.key === 'publication')).toBeUndefined();
  });
});

describe('cada passo muda sozinho quando o dado real é cadastrado', () => {
  it('produtos: passa a "pronto" com o primeiro item com preço e estoque', async () => {
    const [rolamentos] = await getDb().select({ id: products.id }).from(products).where(eq(products.name, 'Rolamentos'));
    await bulkUpdateStoreProducts([{ id: rolamentos!.id, salePriceCents: 3850, stockDelta: 10 }], actor);
    const step = item(await getPublicationChecklist(), 'products');
    expect(step.status).toBe('done');
    expect(step.detail).toMatch(/1 de 13 produtos prontos para vender online; 12 ainda sem preço/);
  });

  it('chave PIX e condições da loja', async () => {
    expect(await statusOf('pix')).toBe('pending');
    await updateStoreSettings({ ...STORE_DEFAULTS, pixKey: '+5581996405805', pixKeyType: 'PHONE', policyText: 'Trocas em até 7 dias com a nota.' }, actor);
    expect(await statusOf('pix')).toBe('done');
    expect(await statusOf('policy')).toBe('done');
  });

  it('entrega é informativa: liga e desliga sem virar pendência', async () => {
    await updateStoreSettings({ ...STORE_DEFAULTS, pixKey: '+5581996405805', pixKeyType: 'PHONE', deliveryEnabled: true }, actor);
    const step = item(await getPublicationChecklist(), 'delivery');
    expect(step).toMatchObject({ status: 'info', required: false });
    expect(step.detail).toMatch(/Entrega ativada/);
  });

  it('política de privacidade: salvar publica, apagar remove (e o texto é normalizado)', async () => {
    expect(await statusOf('privacy')).toBe('pending');

    await updatePrivacyPolicy('  1. Dados\r\n- nome\r\n- telefone\r\n  ', actor);
    expect((await getCompanySettings()).privacyText).toBe('1. Dados\n- nome\n- telefone');
    expect(await statusOf('privacy')).toBe('done');

    await updatePrivacyPolicy('   ', actor);
    expect((await getCompanySettings()).privacyText).toBeNull();
    expect(await statusOf('privacy')).toBe('pending');

    await updatePrivacyPolicy(null, actor);
    expect((await getCompanySettings()).privacyText).toBeNull();

    // cada alteração fica no histórico
    const entries = await getDb().select().from(auditLogs).where(eq(auditLogs.action, 'SETTINGS_UPDATE'));
    const summaries = entries.map((entry) => entry.summary);
    expect(summaries).toContain('Política de privacidade atualizada');
    expect(summaries).toContain('Política de privacidade removida');
  });

  it('endereço público: só conta um endereço real (localhost não vale) e HTTPS acompanha', async () => {
    await setPublicUrl('http://localhost:3000');
    expect(await statusOf('public-url')).toBe('pending');
    expect(await statusOf('https')).toBe('pending');

    await setPublicUrl('http://loja.exemplo.com.br'); // endereço real, mas sem cadeado
    expect(await statusOf('public-url')).toBe('done');
    expect(await statusOf('https')).toBe('pending');

    await setPublicUrl('https://loja.exemplo.com.br/');
    const checklist = await getPublicationChecklist();
    expect(item(checklist, 'public-url')).toMatchObject({ status: 'done' });
    expect(item(checklist, 'public-url').detail).toContain('https://loja.exemplo.com.br');
    expect(item(checklist, 'https').status).toBe('done');
    expect(item(checklist, 'search-console').detail).toContain('https://loja.exemplo.com.br/sitemap.xml');
  });

  it('a variável APP_URL também vale como endereço público', async () => {
    await setPublicUrl(null);
    expect(await statusOf('public-url')).toBe('pending');
    process.env.APP_URL = 'https://www.exemplo.com.br';
    expect(await statusOf('public-url')).toBe('done');
    expect(await statusOf('https')).toBe('done');
    delete process.env.APP_URL;
    await setPublicUrl('https://loja.exemplo.com.br');
  });

  it('dados de demonstração pendentes travam a publicação até serem removidos', async () => {
    const [ventoinha] = await getDb().select({ id: products.id }).from(products).where(eq(products.name, 'Ventoinha'));
    await getDb().update(products).set({ demoPriceCents: 4000 }).where(eq(products.id, ventoinha!.id));
    const pending = item(await getPublicationChecklist(), 'demo');
    expect(pending).toMatchObject({ status: 'pending', required: true, href: '/sistema/configuracoes/dados' });
    expect(pending.detail).toMatch(/Loja em demonstração/);

    await clearDemoData();
    expect(await statusOf('demo')).toBe('done');
  });

  it('senhas temporárias: cada pessoa precisa trocar a sua', async () => {
    expect(await statusOf('passwords')).toBe('pending');
    await getDb().update(users).set({ mustChangePassword: false });
    const step = item(await getPublicationChecklist(), 'passwords');
    expect(step.status).toBe('done');
    expect(step.detail).toMatch(/Todos os usuários ativos já trocaram/);
  });

  it('backup: vale o baixado nos últimos 30 dias; um mais antigo pede um novo', async () => {
    expect(await statusOf('backup')).toBe('pending');

    await getDb().insert(auditLogs).values({ userId: actor.id, userName: actor.name, action: 'BACKUP_DOWNLOAD', summary: 'Backup do banco baixado', createdAt: new Date(Date.now() - 45 * DAY_MS) });
    const old = item(await getPublicationChecklist(), 'backup');
    expect(old.status).toBe('pending');
    expect(old.detail).toMatch(/há mais de 30 dias/);

    await getDb().insert(auditLogs).values({ userId: actor.id, userName: actor.name, action: 'BACKUP_DOWNLOAD', summary: 'Backup do banco baixado', createdAt: new Date(Date.now() - 2 * DAY_MS) });
    const recent = item(await getPublicationChecklist(), 'backup');
    expect(recent.status).toBe('done');
    expect(recent.detail).toMatch(/Último backup baixado em \d{2}\/\d{2}\/\d{4}/);
  });
});

describe('pronto para publicar', () => {
  it('com todos os passos obrigatórios concluídos: ready, sem pendências e sem alerta no sino', async () => {
    const checklist = await getPublicationChecklist();
    expect(checklist.requiredDone).toBe(checklist.requiredTotal);
    expect(checklist.ready).toBe(true);
    expect(await pendingRequiredSteps()).toEqual([]);
    expect((await getSystemAlerts({ permissions: ['settings.manage'] }, TZ)).find((alert) => alert.key === 'publication')).toBeUndefined();
  });

  it('loja fechada: produtos deixam de ser obrigatórios (o site funciona só como vitrine)', async () => {
    const [rolamentos] = await getDb().select({ id: products.id }).from(products).where(eq(products.name, 'Rolamentos'));
    await bulkUpdateStoreProducts([{ id: rolamentos!.id, stockDelta: -10 }], actor); // some o único item vendável
    const withStore = await getPublicationChecklist();
    expect(item(withStore, 'products')).toMatchObject({ status: 'pending', required: true });
    expect(withStore.ready).toBe(false);

    await updateStoreSettings({ ...STORE_DEFAULTS, enabled: false }, actor);
    const closed = await getPublicationChecklist();
    expect(item(closed, 'store-open')).toMatchObject({ status: 'pending', required: false });
    expect(item(closed, 'products')).toMatchObject({ status: 'pending', required: false });
    expect(closed.requiredTotal).toBe(5);
    expect(closed.ready).toBe(true);
  });
});

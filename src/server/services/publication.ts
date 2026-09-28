/**
 * Checklist de publicação: o que ainda falta para o site (e a loja) ficarem prontos e funcionando.
 * Cada passo é calculado com os dados REAIS do sistema (nada é marcado "à mão"): empresa, logo, produtos com preço e
 * estoque, chave PIX, dados de demonstração, endereço público/HTTPS, senhas temporárias e backup.
 */
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { auditLogs, users } from '../db/schema';
import { hasDemoData } from './demo';
import { listSiteImages } from './files';
import { getCompanySettings, isLocalBaseUrl } from './settings';
import { getSiteBaseUrl } from './site';
import { getStoreReadiness } from './store';
import { getStoreSettings } from './store-settings';

export type ChecklistGroup = 'empresa' | 'loja' | 'publicacao';
export type ChecklistStatus = 'done' | 'pending' | 'info';

export interface ChecklistItem {
  key: string;
  group: ChecklistGroup;
  title: string;
  detail: string;
  status: ChecklistStatus;
  /** Obrigatório para publicar; os demais são recomendações ou informações. */
  required: boolean;
  href?: string;
  actionLabel?: string;
}

export interface PublicationChecklist {
  items: ChecklistItem[];
  requiredTotal: number;
  requiredDone: number;
  /** Todos os passos obrigatórios concluídos. */
  ready: boolean;
}

export const CHECKLIST_GROUP_LABEL: Record<ChecklistGroup, string> = {
  empresa: 'Empresa e site',
  loja: 'Loja virtual',
  publicacao: 'Publicação e segurança',
};

const DAY_MS = 86_400_000;

function formatDay(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

export async function getPublicationChecklist(): Promise<PublicationChecklist> {
  const db = getDb();
  const [company, store, readiness, demo, heroImages] = await Promise.all([getCompanySettings(), getStoreSettings(), getStoreReadiness(), hasDemoData(), listSiteImages('HERO')]);
  const baseUrl = await getSiteBaseUrl(company);
  const configuredUrl = company.publicBaseUrl?.trim() || process.env.APP_URL?.trim() || '';

  const pendingPasswordUsers = await db
    .select({ name: users.name })
    .from(users)
    .where(and(eq(users.isActive, true), eq(users.mustChangePassword, true)));
  const [lastBackupRow] = await db
    .select({ at: sql<number | null>`MAX(${auditLogs.createdAt})` })
    .from(auditLogs)
    .where(eq(auditLogs.action, 'BACKUP_DOWNLOAD'));
  const lastBackup = lastBackupRow?.at ? new Date(Number(lastBackupRow.at)) : null;

  const items: ChecklistItem[] = [];

  // ---------- Empresa e site ----------
  const missing: string[] = [];
  if (!company.name?.trim()) missing.push('nome');
  if (!company.cnpj?.trim()) missing.push('CNPJ');
  if (!company.email?.trim()) missing.push('e-mail');
  if (!company.whatsapp?.trim()) missing.push('WhatsApp');
  if (!company.address?.trim()) missing.push('endereço');
  if (!company.city?.trim() || !company.state?.trim()) missing.push('cidade/UF');
  if (!Object.values(company.hours).some((day) => !day.closed)) missing.push('horário de atendimento');
  items.push({
    key: 'company',
    group: 'empresa',
    title: 'Dados oficiais da empresa',
    detail: missing.length === 0 ? 'Nome, CNPJ, e-mail, WhatsApp, endereço e horários preenchidos. Eles alimentam o site, os documentos e os PDFs.' : `Faltam: ${missing.join(', ')}.`,
    status: missing.length === 0 ? 'done' : 'pending',
    required: true,
    href: '/sistema/configuracoes',
    actionLabel: 'Abrir dados da empresa',
  });
  items.push({
    key: 'logo',
    group: 'empresa',
    title: 'Logo oficial da empresa',
    detail: company.logoFileId ? 'Logo enviada: aparece no site, no sistema e nos PDFs.' : 'Sem a logo o site usa o nome em texto como marca provisória. Envie o arquivo oficial (PNG com fundo transparente é o ideal).',
    status: company.logoFileId ? 'done' : 'pending',
    required: false,
    href: '/sistema/configuracoes/logo',
    actionLabel: 'Enviar logo',
  });
  items.push({
    key: 'photos',
    group: 'empresa',
    title: 'Foto principal do site',
    detail: heroImages.length > 0 ? 'Foto principal enviada.' : 'Sem foto real o site usa ilustrações técnicas. Envie uma foto da oficina/equipe e, se quiser, a galeria.',
    status: heroImages.length > 0 ? 'done' : 'pending',
    required: false,
    href: '/sistema/configuracoes/logo',
    actionLabel: 'Enviar fotos',
  });

  // ---------- Loja virtual ----------
  const storeOpen = store.enabled;
  items.push({
    key: 'store-open',
    group: 'loja',
    title: 'Loja virtual aberta',
    detail: storeOpen ? 'A loja está aberta ao público.' : 'A loja está fechada: o site mostra os produtos só para consulta pelo WhatsApp (sem carrinho).',
    status: storeOpen ? 'done' : 'pending',
    required: false,
    href: '/sistema/configuracoes/loja',
    actionLabel: 'Abrir configurações da loja',
  });
  const noPrice = Math.max(0, readiness.visible - readiness.withPrice);
  items.push({
    key: 'products',
    group: 'loja',
    title: 'Produtos com preço e estoque',
    detail:
      readiness.sellable > 0
        ? `${readiness.sellable} de ${readiness.visible} produtos prontos para vender online${noPrice > 0 ? `; ${noPrice} ainda sem preço (aparecem como “valor sob consulta”)` : ''}.`
        : `Nenhum produto pode ser comprado ainda (${readiness.visible} no site, ${readiness.withPrice} com preço). Cadastre o preço de venda e o estoque de cada item — nenhum preço é inventado.`,
    status: readiness.sellable > 0 ? 'done' : 'pending',
    required: storeOpen,
    href: '/sistema/loja/produtos',
    actionLabel: 'Cadastrar preços e estoque',
  });
  items.push({
    key: 'pix',
    group: 'loja',
    title: 'Chave PIX para receber online',
    detail: store.pixKey ? 'Chave PIX cadastrada: a loja oferece pagamento por PIX (QR Code e copia e cola).' : 'Sem chave PIX a loja só oferece “pagar na retirada”. Cadastre a chave da empresa para receber pelo site.',
    status: store.pixKey ? 'done' : 'pending',
    required: false,
    href: '/sistema/configuracoes/loja',
    actionLabel: 'Cadastrar chave PIX',
  });
  items.push({
    key: 'delivery',
    group: 'loja',
    title: 'Entrega de produtos',
    detail: store.deliveryEnabled ? 'Entrega ativada no checkout.' : 'Desligada: só retirada na loja. Ative se a empresa entrega peças (defina taxa e região).',
    status: 'info',
    required: false,
    href: '/sistema/configuracoes/loja',
    actionLabel: 'Definir entrega',
  });
  items.push({
    key: 'policy',
    group: 'loja',
    title: 'Condições da loja (trocas e devoluções)',
    detail: store.policyText ? 'Texto das condições exibido no checkout com aceite do cliente.' : 'Recomendado: escreva a política de trocas, devoluções e prazos que a empresa pratica.',
    status: store.policyText ? 'done' : 'pending',
    required: false,
    href: '/sistema/configuracoes/loja',
    actionLabel: 'Escrever condições',
  });
  const hasPrivacy = Boolean(company.privacyText?.trim());
  items.push({
    key: 'privacy',
    group: 'loja',
    title: 'Política de privacidade (LGPD)',
    detail: hasPrivacy
      ? 'Política publicada em /privacidade, com link no rodapé do site e no checkout.'
      : 'A loja recebe nome, telefone e endereço dos clientes; a LGPD pede que a empresa explique como usa esses dados. Há um modelo pronto — revise com o contador ou um advogado antes de publicar.',
    status: hasPrivacy ? 'done' : 'pending',
    required: false,
    href: '/sistema/configuracoes#privacidade',
    actionLabel: 'Escrever política',
  });
  items.push({
    key: 'demo',
    group: 'loja',
    title: 'Dados de demonstração removidos',
    detail: demo ? 'Ainda existem clientes, ordens, pedidos e/ou preços fictícios de demonstração (a loja exibe o aviso “Loja em demonstração”). Remova antes de publicar.' : 'Nenhum dado fictício no sistema.',
    status: demo ? 'pending' : 'done',
    required: true,
    href: '/sistema/configuracoes/dados',
    actionLabel: 'Remover demonstração',
  });

  // ---------- Publicação e segurança ----------
  const urlConfigured = configuredUrl !== '' && !isLocalBaseUrl(configuredUrl);
  items.push({
    key: 'public-url',
    group: 'publicacao',
    title: 'Endereço público do site',
    detail: urlConfigured
      ? `Configurado: ${configuredUrl}. Usado em links de PDF, WhatsApp, SEO e no acompanhamento de pedidos.`
      : 'Informe o endereço real (ex.: https://www.seudominio.com.br) em Configurações → Empresa ou na variável APP_URL. Sem ele, os links enviados ao cliente (PDF, acompanhamento do pedido) não abrem fora deste computador.',
    status: urlConfigured ? 'done' : 'pending',
    required: true,
    href: '/sistema/configuracoes',
    actionLabel: 'Informar endereço público',
  });
  const https = baseUrl.startsWith('https://') && !isLocalBaseUrl(baseUrl);
  items.push({
    key: 'https',
    group: 'publicacao',
    title: 'Site com HTTPS (cadeado)',
    detail: https ? 'O site está sendo acessado por HTTPS.' : 'O site precisa de HTTPS em produção (o login usa cookie seguro e o navegador avisa “não seguro” sem ele). Configure o certificado no servidor/hospedagem.',
    status: https ? 'done' : 'pending',
    required: true,
  });
  items.push({
    key: 'passwords',
    group: 'publicacao',
    title: 'Senhas temporárias trocadas',
    detail:
      pendingPasswordUsers.length === 0
        ? 'Todos os usuários ativos já trocaram a senha temporária.'
        : `Ainda com senha temporária: ${pendingPasswordUsers.map((u) => u.name).join(', ')}. Cada pessoa precisa entrar e criar a própria senha.`,
    status: pendingPasswordUsers.length === 0 ? 'done' : 'pending',
    required: true,
    href: '/sistema/usuarios',
    actionLabel: 'Ver usuários',
  });
  const recentBackup = lastBackup !== null && Date.now() - lastBackup.getTime() < 30 * DAY_MS;
  items.push({
    key: 'backup',
    group: 'publicacao',
    title: 'Backup do banco de dados',
    detail: recentBackup ? `Último backup baixado em ${formatDay(lastBackup!, company.timezone)}. Repita toda semana.` : lastBackup ? `Último backup baixado em ${formatDay(lastBackup, company.timezone)} (há mais de 30 dias). Baixe um novo e guarde em outro lugar.` : 'Nenhum backup baixado pelo sistema ainda. Baixe um e guarde em outro lugar (nuvem ou HD externo); agende cópias semanais no servidor.',
    status: recentBackup ? 'done' : 'pending',
    required: false,
    href: '/sistema/configuracoes/dados',
    actionLabel: 'Baixar backup',
  });
  items.push({
    key: 'seo',
    group: 'publicacao',
    title: 'Título e descrição no Google',
    detail: company.seoTitle?.trim() && company.seoDescription?.trim() ? 'Título e descrição definidos. Revise se quiser ajustar o texto que aparece nos resultados de busca.' : 'Defina o título e a descrição que aparecem no Google.',
    status: company.seoTitle?.trim() && company.seoDescription?.trim() ? 'done' : 'pending',
    required: false,
    href: '/sistema/configuracoes/site',
    actionLabel: 'Abrir SEO',
  });
  items.push({
    key: 'search-console',
    group: 'publicacao',
    title: 'Enviar o sitemap ao Google',
    detail: `Depois de publicar, cadastre o site no Google Search Console e envie ${baseUrl}/sitemap.xml para o Google encontrar a loja e cada produto.`,
    status: 'info',
    required: false,
  });

  const required = items.filter((item) => item.required);
  const requiredDone = required.filter((item) => item.status === 'done').length;
  return { items, requiredTotal: required.length, requiredDone, ready: requiredDone === required.length };
}

/** Passos obrigatórios ainda pendentes (alerta no sino do administrador). */
export async function pendingRequiredSteps(): Promise<ChecklistItem[]> {
  const checklist = await getPublicationChecklist();
  return checklist.items.filter((item) => item.required && item.status !== 'done');
}

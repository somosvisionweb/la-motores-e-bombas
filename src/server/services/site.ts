/**
 * Dados do site público (empresa, serviços, produtos, imagens).
 * Cache curto em memória: o site fica rápido e as edições feitas no sistema aparecem em até 60 segundos
 * (ou imediatamente, pois as ações chamam `invalidateSiteCache`). O cache guarda a *promessa*, então
 * requisições simultâneas (layout + página, robots, sitemap…) compartilham a mesma consulta.
 */
import { headers } from 'next/headers';
import { SERVICE_GROUPS } from '@/config/official-catalog';
import { listSiteServices } from './catalog-services';
import { listSiteImages } from './files';
import { listSiteProducts } from './products';
import { getCompanySettings } from './settings';

export interface SiteData {
  company: Awaited<ReturnType<typeof getCompanySettings>>;
  serviceGroups: { name: string; services: { id: number; name: string; description: string | null }[] }[];
  products: Awaited<ReturnType<typeof listSiteProducts>>;
  heroImage: Awaited<ReturnType<typeof listSiteImages>>[number] | null;
  gallery: Awaited<ReturnType<typeof listSiteImages>>;
}

interface CacheEntry {
  at: number;
  key: string;
  promise: Promise<SiteData>;
}

const TTL_MS = 60_000;
const g = globalThis as unknown as { __laSiteCache?: CacheEntry };

export function invalidateSiteCache(): void {
  g.__laSiteCache = undefined;
}

async function loadSiteData(): Promise<SiteData> {
  const [company, services, products, images] = await Promise.all([getCompanySettings(), listSiteServices(), listSiteProducts(), listSiteImages()]);

  // Agrupa os serviços na ordem oficial dos grupos; grupos personalizados vêm depois.
  const byGroup = new Map<string, SiteData['serviceGroups'][number]['services']>();
  for (const service of services) {
    const list = byGroup.get(service.category) ?? [];
    list.push({ id: service.id, name: service.name, description: service.description });
    byGroup.set(service.category, list);
  }
  const official = SERVICE_GROUPS as readonly string[];
  const ordered = [...official.filter((name) => byGroup.has(name)), ...[...byGroup.keys()].filter((name) => !official.includes(name))];

  return {
    company,
    serviceGroups: ordered.map((name) => ({ name, services: byGroup.get(name)! })),
    products,
    heroImage: images.find((i) => i.slot === 'HERO') ?? null,
    gallery: images.filter((i) => i.slot === 'GALLERY'),
  };
}

/**
 * Endereço público do site (canonical, Open Graph, sitemap, dados estruturados).
 * Ordem: URL configurada em Configurações → Site, variável APP_URL, ou o próprio host da requisição
 * (assim a publicação funciona sem configuração extra); em último caso, localhost.
 */
export async function getSiteBaseUrl(company: Pick<SiteData['company'], 'publicBaseUrl'>): Promise<string> {
  const configured = company.publicBaseUrl?.trim() || process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  try {
    const requestHeaders = await headers();
    const host = requestHeaders.get('host');
    if (host && /^[a-z0-9.-]+(:\d+)?$/i.test(host)) {
      const local = /^(localhost|127\.|0\.0\.0\.0|192\.168\.|10\.)/i.test(host);
      const proto = requestHeaders.get('x-forwarded-proto') === 'http' || local ? 'http' : 'https';
      return `${proto}://${host}`;
    }
  } catch {
    // fora de uma requisição (ex.: build): usa o padrão de desenvolvimento
  }
  return 'http://localhost:3000';
}

export function getSiteData(): Promise<SiteData> {
  const key = process.env.DATABASE_URL ?? 'default';
  const cached = g.__laSiteCache;
  if (cached && cached.key === key && Date.now() - cached.at < TTL_MS) return cached.promise;

  const promise = loadSiteData();
  const entry: CacheEntry = { at: Date.now(), key, promise };
  g.__laSiteCache = entry;
  // Uma falha não pode ficar em cache: a próxima requisição tenta de novo.
  promise.catch(() => {
    if (g.__laSiteCache === entry) g.__laSiteCache = undefined;
  });
  return promise;
}

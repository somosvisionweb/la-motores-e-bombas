import type { MetadataRoute } from 'next';
import { getSiteBaseUrl, getSiteData } from '@/server/services/site';

export const dynamic = 'force-dynamic';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const { company } = await getSiteData();
  const baseUrl = await getSiteBaseUrl(company);
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/sistema', '/imprimir', '/api/', '/d/', '/login', '/trocar-senha', '/loja/carrinho', '/loja/finalizar', '/loja/pedido/'] }],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

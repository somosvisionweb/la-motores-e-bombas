import type { MetadataRoute } from 'next';
import { getSiteBaseUrl, getSiteData } from '@/server/services/site';
import { listStoreProducts } from '@/server/services/store';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { company } = await getSiteData();
  const baseUrl = await getSiteBaseUrl(company);
  const entries: MetadataRoute.Sitemap = [{ url: `${baseUrl}/`, lastModified: company.updatedAt, changeFrequency: 'monthly', priority: 1 }];

  if (company.privacyText?.trim()) entries.push({ url: `${baseUrl}/privacidade`, lastModified: company.updatedAt, changeFrequency: 'yearly', priority: 0.2 });

  // Loja virtual aberta: catálogo e páginas de produto (carrinho, checkout e pedidos ficam de fora).
  const store = await listStoreProducts();
  if (store.config.enabled) {
    entries.push({ url: `${baseUrl}/loja`, changeFrequency: 'weekly', priority: 0.9 });
    for (const product of store.products) {
      entries.push({ url: `${baseUrl}${product.href}`, changeFrequency: 'weekly', priority: 0.7 });
    }
  }
  return entries;
}

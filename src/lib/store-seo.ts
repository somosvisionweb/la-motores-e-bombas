import type { Metadata } from 'next';

/** Metadados de uma página da loja (título, descrição, endereço canônico e Open Graph). */
export function storeMetadata(input: { title: string; description: string; path: string; siteName: string; image?: string | null; noindex?: boolean }): Metadata {
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: input.path },
    openGraph: {
      type: 'website',
      locale: 'pt_BR',
      siteName: input.siteName,
      title: input.title,
      description: input.description,
      url: input.path,
      ...(input.image ? { images: [{ url: input.image }] } : {}),
    },
    twitter: { card: 'summary_large_image', title: input.title, description: input.description },
    ...(input.noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

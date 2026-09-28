import { PAYMENT_METHOD_LABEL, isPaymentMethod } from '@/config/payment-methods';
import { instagramUrl, openingHoursSpecification, type CompanyLike } from './company';
import { toWhatsAppNumber } from './phone';

/** Títulos e descrições usados quando a empresa não preencheu Configurações → Site (SEO). */
export const DEFAULT_SEO_TITLE = 'LA Motores e Bombas | Assistência Técnica em Jaboatão dos Guararapes';
export const DEFAULT_SEO_DESCRIPTION =
  'Assistência técnica em motores elétricos e bombas d’água em Jaboatão dos Guararapes: manutenção, conserto, rebobinamento e atendimento a domicílio.';

/** Palavras-chave naturais (ligadas ao que a empresa realmente faz e ao local; sem repetição em excesso). */
export const SEO_KEYWORDS = [
  'assistência técnica de motores elétricos',
  'rebobinamento de motores elétricos',
  'manutenção de bombas d’água',
  'rebobinamento de bombas',
  'conserto de bombas',
  'motores e bombas em Jaboatão dos Guararapes',
  'assistência técnica em Jaboatão dos Guararapes',
  'atendimento a domicílio',
];

export interface SeoCompany extends CompanyLike {
  paymentMethods: string[];
  logoFileId: number | null;
}

/** Dados estruturados (schema.org) da empresa local: só informações cadastradas, nada inventado. */
export function buildLocalBusinessJsonLd(input: {
  company: SeoCompany;
  baseUrl: string;
  description: string;
  services: { name: string }[];
  heroFileId: number | null;
}) {
  const { company, baseUrl, description, services, heroFileId } = input;
  const phoneDigits = toWhatsAppNumber(company.phone || company.whatsapp);
  const instagram = instagramUrl(company);
  const payments = company.paymentMethods.filter(isPaymentMethod).map((key) => PAYMENT_METHOD_LABEL[key]);
  const logo = company.logoFileId ? `${baseUrl}/media/${company.logoFileId}` : null;
  const image = heroFileId ? `${baseUrl}/media/${heroFileId}` : logo;

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${baseUrl}/#empresa`,
    name: company.name,
    url: baseUrl,
    description,
  };
  if (phoneDigits) data.telephone = `+${phoneDigits}`;
  if (company.email) data.email = company.email;
  if (company.cnpj) data.taxID = company.cnpj;
  if (logo) data.logo = logo;
  if (image) data.image = image;
  if (company.address || company.city) {
    data.address = {
      '@type': 'PostalAddress',
      streetAddress: company.address ?? undefined,
      addressLocality: company.city ?? undefined,
      addressRegion: company.state ?? undefined,
      postalCode: company.zip ?? undefined,
      addressCountry: 'BR',
    };
  }
  const hours = openingHoursSpecification(company.hours);
  if (hours.length > 0) data.openingHoursSpecification = hours;
  if (instagram) data.sameAs = [instagram];
  if (payments.length > 0) data.paymentAccepted = payments.join(', ');
  if (services.length > 0) {
    data.hasOfferCatalog = {
      '@type': 'OfferCatalog',
      name: 'Serviços',
      itemListElement: services.map((service) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: service.name } })),
    };
  }
  return data;
}

/** Serializa JSON-LD com segurança para `<script>` (evita fechar a tag por engano). */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

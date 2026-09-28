import type { WhatsAppTemplates } from '@/config/company';
import { instagramUrl, mapsUrl, renderCompanyMessage, whatsappLink, type CompanyLike } from './company';

export type SiteCompany = CompanyLike & { whatsappTemplates: WhatsAppTemplates };

export interface SiteLinks {
  general: string;
  attendance: string;
  quote: string;
  homeVisit: string;
  /** Orçamento de um serviço específico. */
  service: (name: string) => string;
  /** Consulta de disponibilidade de um produto. */
  product: (name: string) => string;
  instagram: string | null;
  maps: string;
}

/**
 * Links do site (WhatsApp com mensagem pré-preenchida, Instagram, mapa).
 * Textos vêm dos modelos editáveis em Configurações → Mensagens. Sem número de WhatsApp cadastrado,
 * os botões levam à seção de contato em vez de gerar um link quebrado.
 */
export function buildSiteLinks(company: SiteCompany): SiteLinks {
  const templates = company.whatsappTemplates;
  const chat = (message: string) => whatsappLink(company, message) ?? '#contato';
  const text = (template: string) => renderCompanyMessage(template, company);
  return {
    general: chat(text(templates.general)),
    attendance: chat(text(templates.attendance)),
    quote: chat(text(templates.quote)),
    homeVisit: chat(text(templates.homeVisit)),
    service: (name) => chat(`${text(templates.quote)}\n\nServiço de interesse: ${name}`),
    product: (name) => chat(`${text(templates.general)}\n\nGostaria de consultar a disponibilidade de: ${name}`),
    instagram: instagramUrl(company) || null,
    maps: mapsUrl(company),
  };
}

/** Links externos abrem em nova aba com `noopener`; âncoras internas não. */
export function linkProps(href: string): { target?: '_blank'; rel?: string } {
  return href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {};
}

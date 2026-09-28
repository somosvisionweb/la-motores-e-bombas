import { describe, expect, it } from 'vitest';
import type { BusinessHours, WhatsAppTemplates } from '@/config/company';
import { OFFICIAL_COMPANY, OFFICIAL_HOURS } from '@/config/company-defaults';
import { DEFAULT_TERMS_CONTENT } from '@/config/guarantee-terms-default';
import { OFFICIAL_PRODUCTS, OFFICIAL_SERVICES, SERVICE_GROUPS } from '@/config/official-catalog';
import { SITE_NAV } from '@/config/site-nav';
import { SITE_COPY } from '@/content/site';
import { addressLines, fullAddress, groupBusinessHours, instagramHandle, instagramUrl, mapsUrl, openingHoursSpecification, phoneDisplay, splitBrandName } from '@/lib/company';
import { buildLocalBusinessJsonLd, DEFAULT_SEO_DESCRIPTION, DEFAULT_SEO_TITLE, serializeJsonLd } from '@/lib/seo';
import { buildSiteLinks, linkProps, type SiteCompany } from '@/lib/site-links';
import { parseTermsMarkup } from '@/lib/terms-markup';

const company: SiteCompany = {
  ...OFFICIAL_COMPANY,
  hours: OFFICIAL_HOURS,
  whatsappTemplates: OFFICIAL_COMPANY.whatsappTemplates as WhatsAppTemplates,
};

describe('dados oficiais da empresa', () => {
  it('CNPJ, e-mail, WhatsApp, endereço e Instagram conforme o cadastro oficial', () => {
    expect(company.name).toBe('LA Motores e Bombas');
    expect(company.cnpj).toBe('31.127.662/0001-50');
    expect(company.email).toBe('lamotoreseletricos@gmail.com');
    expect(company.whatsapp).toBe('5581996405805');
    expect(phoneDisplay(company)).toBe('(81) 99640-5805');
    expect(addressLines(company)).toEqual(['Rua Serafim Luiz Pinto, 15', 'Jaboatão dos Guararapes - PE']);
    expect(fullAddress(company)).toBe('Rua Serafim Luiz Pinto, 15 - Jaboatão dos Guararapes - PE');
    expect(instagramHandle(company)).toBe('@l.a_motores_e_bombas');
    expect(instagramUrl(company)).toBe('https://www.instagram.com/l.a_motores_e_bombas/');
  });

  it('catálogo oficial: 19 serviços e 13 produtos, nenhum a mais', () => {
    expect(OFFICIAL_SERVICES).toHaveLength(19);
    expect(OFFICIAL_PRODUCTS).toHaveLength(13);
    expect(new Set(OFFICIAL_SERVICES.map((s) => s.name)).size).toBe(19);
    expect(OFFICIAL_SERVICES.every((s) => (SERVICE_GROUPS as readonly string[]).includes(s.category))).toBe(true);
    expect(OFFICIAL_PRODUCTS.map((p) => p.name)).toEqual([
      'Rolamentos',
      'Selo mecânico',
      'Capacitor permanente',
      'Capacitor eletrolítico',
      'Centrífugo',
      'Platinado',
      'Ventoinha',
      'Tampa intermediária',
      'Tampa dianteira',
      'Tampa traseira',
      'Manômetro',
      'Polia',
      'Rotor',
    ]);
  });

  it('marca tipográfica destaca a sigla "LA"', () => {
    expect(splitBrandName('LA Motores e Bombas')).toEqual({ accent: 'LA', rest: 'Motores e Bombas' });
    expect(splitBrandName('Oficina do Zé')).toEqual({ accent: null, rest: 'Oficina do Zé' });
  });
});

describe('horários de atendimento', () => {
  it('agrupa dias iguais: segunda a sexta, sábado e domingo fechado', () => {
    const groups = groupBusinessHours(OFFICIAL_HOURS);
    expect(groups.map((g) => [g.label, g.value])).toEqual([
      ['Segunda a sexta', '08:00 às 17:00'],
      ['Sábado', '08:00 às 12:00'],
      ['Domingo', 'Fechado'],
    ]);
  });

  it('todos os dias iguais viram "Todos os dias"; domingo aberto sai do grupo do sábado', () => {
    const open = { closed: false, open: '07:00', close: '18:00' };
    const allDays = { mon: open, tue: open, wed: open, thu: open, fri: open, sat: open, sun: open } as BusinessHours;
    expect(groupBusinessHours(allDays)).toHaveLength(1);
    expect(groupBusinessHours(allDays)[0]!.label).toBe('Todos os dias');
    const withSunday = { ...OFFICIAL_HOURS, sun: { closed: false, open: '09:00', close: '11:00' } } as BusinessHours;
    expect(groupBusinessHours(withSunday).map((g) => g.label)).toEqual(['Segunda a sexta', 'Sábado', 'Domingo']);
  });

  it('dados estruturados listam só os dias abertos, no formato do schema.org', () => {
    const spec = openingHoursSpecification(OFFICIAL_HOURS);
    expect(spec.map((s) => s.dayOfWeek)).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
    expect(spec[5]).toMatchObject({ opens: '08:00', closes: '12:00' });
  });
});

describe('links do site (WhatsApp, mapa, Instagram)', () => {
  const links = buildSiteLinks(company);

  it('WhatsApp usa o número oficial com mensagem pré-preenchida', () => {
    for (const href of [links.general, links.attendance, links.quote, links.homeVisit]) {
      expect(href.startsWith('https://wa.me/5581996405805?text=')).toBe(true);
    }
    expect(decodeURIComponent(links.homeVisit.split('?text=')[1]!)).toBe('Olá! Gostaria de solicitar um atendimento a domicílio da LA Motores e Bombas.');
  });

  it('serviço e produto acrescentam o item de interesse à mensagem', () => {
    const service = decodeURIComponent(links.service('Rebobinamento de bombas').split('?text=')[1]!);
    expect(service).toContain('orçamento');
    expect(service).toContain('Serviço de interesse: Rebobinamento de bombas');
    const product = decodeURIComponent(links.product('Selo mecânico').split('?text=')[1]!);
    expect(product).toContain('disponibilidade de: Selo mecânico');
  });

  it('Instagram e "Como chegar" apontam para os endereços corretos', () => {
    expect(links.instagram).toBe('https://www.instagram.com/l.a_motores_e_bombas/');
    expect(links.maps).toBe(mapsUrl(company));
    expect(decodeURIComponent(links.maps)).toContain('Rua Serafim Luiz Pinto, 15 - Jaboatão dos Guararapes - PE');
  });

  it('sem WhatsApp cadastrado os botões levam ao contato, sem link quebrado', () => {
    const none = buildSiteLinks({ ...company, whatsapp: null });
    expect(none.general).toBe('#contato');
    expect(linkProps('#contato')).toEqual({});
    expect(linkProps(links.general)).toEqual({ target: '_blank', rel: 'noopener noreferrer' });
  });

  it('menu do site tem as 7 entradas definidas pela empresa, na ordem', () => {
    expect(SITE_NAV.map((item) => item.label)).toEqual(['Início', 'Sobre nós', 'Serviços', 'Produtos', 'Diferencial', 'Atendimento', 'Contato']);
  });
});

describe('SEO e dados estruturados', () => {
  it('título e descrição padrão são os definidos no briefing', () => {
    expect(DEFAULT_SEO_TITLE).toBe('LA Motores e Bombas | Assistência Técnica em Jaboatão dos Guararapes');
    expect(DEFAULT_SEO_DESCRIPTION.length).toBeLessThanOrEqual(200);
  });

  it('LocalBusiness usa só dados cadastrados e inclui os serviços como catálogo', () => {
    const data = buildLocalBusinessJsonLd({
      company: { ...company, paymentMethods: ['PIX', 'DINHEIRO'], logoFileId: null },
      baseUrl: 'https://exemplo.com.br',
      description: 'Descrição',
      services: OFFICIAL_SERVICES.map((s) => ({ name: s.name })),
      heroFileId: null,
    }) as Record<string, unknown> & { address: Record<string, string>; hasOfferCatalog: { itemListElement: unknown[] } };
    expect(data['@type']).toBe('LocalBusiness');
    expect(data.telephone).toBe('+5581996405805');
    expect(data.taxID).toBe('31.127.662/0001-50');
    expect(data.address.streetAddress).toBe('Rua Serafim Luiz Pinto, 15');
    expect(data.address.addressLocality).toBe('Jaboatão dos Guararapes');
    expect(data.paymentAccepted).toBe('PIX, Dinheiro');
    expect(data.hasOfferCatalog.itemListElement).toHaveLength(19);
    expect(data).not.toHaveProperty('logo');
    expect(data).not.toHaveProperty('aggregateRating');
    expect(data).not.toHaveProperty('priceRange');
  });

  it('serialização impede fechar a tag <script> por engano', () => {
    const json = serializeJsonLd({ name: '</script><script>alert(1)</script>' });
    expect(json).not.toContain('</script>');
    expect(JSON.parse(json).name).toBe('</script><script>alert(1)</script>');
  });
});

describe('textos institucionais e termos de garantia', () => {
  it('a headline é exatamente a definida pela empresa e o trecho em destaque existe nela', () => {
    expect(SITE_COPY.heroHeadline).toBe('Seu equipamento parado não precisa virar prejuízo.');
    expect(SITE_COPY.heroHeadline.includes(SITE_COPY.heroAccent)).toBe(true);
  });

  it('termos padrão: 5 cláusulas, declaração do cliente e o prazo entra por marcador', () => {
    expect(DEFAULT_TERMS_CONTENT).toContain('{{prazo_garantia}}');
    expect(DEFAULT_TERMS_CONTENT).toContain('ABNT NBR 5410');
    const blocks = parseTermsMarkup(DEFAULT_TERMS_CONTENT, 3);
    const clauses = blocks.filter((b) => b.type === 'clause');
    expect(clauses).toHaveLength(5);
    expect(clauses[0]).toMatchObject({ text: '1. Prazo de garantia' });
    const flat = JSON.stringify(blocks);
    expect(flat).toContain('3 (três) meses');
    expect(flat).not.toContain('{{prazo_garantia}}');
  });
});

import { describe, expect, it } from 'vitest';
import type { BusinessHours, WhatsAppTemplates } from '@/config/company';
import { OFFICIAL_COMPANY, OFFICIAL_HOURS } from '@/config/company-defaults';
import { buildPrivacyTemplate } from '@/content/privacy-template';
import type { CompanyLike } from '@/lib/company';
import { parsePolicyText, PRIVACY_TEXT_MAX } from '@/lib/policy-text';
import { STORE_LISTING_KEYS, STORE_LISTING_STATUS, storeListingStatus } from '@/lib/store-pricing';
import { quickProductSchema } from '@/lib/validation/catalog';
import { privacyPolicySchema } from '@/lib/validation/settings';

const company: CompanyLike & { hours: BusinessHours; whatsappTemplates: WhatsAppTemplates } = {
  ...OFFICIAL_COMPANY,
  hours: OFFICIAL_HOURS,
  whatsappTemplates: OFFICIAL_COMPANY.whatsappTemplates as WhatsAppTemplates,
};

const base = { isActive: true, showOnSite: true, sellOnline: true, salePriceCents: 4500, stock: 10 };

describe('situação do produto na loja (o que a equipe precisa fazer)', () => {
  it('ativo, visível, vendido online, com preço real e estoque: à venda', () => {
    expect(storeListingStatus(base)).toBe('ON_SALE');
  });

  it('sem estoque, sem preço, só consulta e oculto — na ordem de prioridade', () => {
    expect(storeListingStatus({ ...base, stock: 0 })).toBe('OUT_OF_STOCK');
    expect(storeListingStatus({ ...base, stock: -2 })).toBe('OUT_OF_STOCK');
    expect(storeListingStatus({ ...base, salePriceCents: 0 })).toBe('NO_PRICE');
    // sem preço E sem estoque: falta o preço primeiro (é o que impede a venda de verdade)
    expect(storeListingStatus({ ...base, salePriceCents: 0, stock: 0 })).toBe('NO_PRICE');
    expect(storeListingStatus({ ...base, sellOnline: false })).toBe('CONSULT_ONLY');
    expect(storeListingStatus({ ...base, sellOnline: false, salePriceCents: 0 })).toBe('CONSULT_ONLY');
    expect(storeListingStatus({ ...base, showOnSite: false })).toBe('HIDDEN');
    expect(storeListingStatus({ ...base, isActive: false, sellOnline: false })).toBe('HIDDEN');
  });

  it('todas as situações têm rótulo, tom e explicação para a tela', () => {
    for (const key of STORE_LISTING_KEYS) {
      const info = STORE_LISTING_STATUS[key];
      expect(info.label.length).toBeGreaterThan(2);
      expect(info.hint.length).toBeGreaterThan(10);
      expect(info.tone).toBeTruthy();
    }
    expect(STORE_LISTING_STATUS.ON_SALE.label).toBe('À venda');
  });
});

describe('cadastro rápido de item da loja', () => {
  it('nome e categoria são obrigatórios; estoque começa em 0', () => {
    const ok = quickProductSchema.parse({ name: '  Capacitor 25 µF  ', category: 'Capacitores', salePriceCents: '4500' });
    expect(ok).toEqual({ name: 'Capacitor 25 µF', category: 'Capacitores', salePriceCents: 4500, stock: 0 });

    const missing = quickProductSchema.safeParse({ name: '', category: '', salePriceCents: '0' });
    expect(missing.success).toBe(false);
    const fields = missing.success ? [] : missing.error.issues.map((issue) => issue.path[0]);
    expect(fields).toEqual(expect.arrayContaining(['name', 'category']));
  });

  it('preço 0 é permitido (valor sob consulta); negativo, decimal e estoque inválido são recusados', () => {
    expect(quickProductSchema.parse({ name: 'Polia', category: 'Peças', salePriceCents: '0', stock: '3' })).toMatchObject({ salePriceCents: 0, stock: 3 });
    expect(quickProductSchema.safeParse({ name: 'X', category: 'Y', salePriceCents: '-1' }).success).toBe(false);
    expect(quickProductSchema.safeParse({ name: 'X', category: 'Y', salePriceCents: '10.5' }).success).toBe(false);
    expect(quickProductSchema.safeParse({ name: 'X', category: 'Y', salePriceCents: '100', stock: '-1' }).success).toBe(false);
    expect(quickProductSchema.safeParse({ name: 'X', category: 'Y', salePriceCents: '100', stock: '2.5' }).success).toBe(false);
    expect(quickProductSchema.safeParse({ name: 'X'.repeat(121), category: 'Y', salePriceCents: '100' }).success).toBe(false);
  });
});

describe('texto da política (sem HTML livre)', () => {
  it('linha em branco separa parágrafos; "1. Título" vira subtítulo; "- item" vira lista', () => {
    const blocks = parsePolicyText('Introdução.\n\n1. Dados coletados\n- nome\n- telefone\n\nOutro parágrafo\ncom duas linhas.\n\n2. Contato\nescreva para nós');
    expect(blocks).toEqual([
      { type: 'paragraph', text: 'Introdução.' },
      { type: 'heading', text: '1. Dados coletados' },
      { type: 'list', items: ['nome', 'telefone'] },
      { type: 'paragraph', text: 'Outro parágrafo\ncom duas linhas.' },
      { type: 'heading', text: '2. Contato' },
      { type: 'paragraph', text: 'escreva para nós' },
    ]);
  });

  it('frase numerada longa ou terminada em ponto não vira subtítulo; quebras de linha do Windows são aceitas', () => {
    expect(parsePolicyText('1. Esta frase termina com ponto.')).toEqual([{ type: 'paragraph', text: '1. Esta frase termina com ponto.' }]);
    expect(parsePolicyText(`1. ${'a'.repeat(90)}`)[0]!.type).toBe('paragraph');
    expect(parsePolicyText('1. Título\r\n- a\r\n- b\r\n')).toEqual([
      { type: 'heading', text: '1. Título' },
      { type: 'list', items: ['a', 'b'] },
    ]);
    expect(parsePolicyText('   \n\n  ')).toEqual([]);
  });

  it('HTML digitado fica como texto (o componente o exibe escapado)', () => {
    const blocks = parsePolicyText('<script>alert(1)</script>\n- <b>negrito</b>');
    expect(blocks).toEqual([
      { type: 'paragraph', text: '<script>alert(1)</script>' },
      { type: 'list', items: ['<b>negrito</b>'] },
    ]);
  });

  it('o modelo gerado é lido como política completa: 6 seções, listas e nenhuma sobra de marcação', () => {
    const text = buildPrivacyTemplate(company, '26/09/2026');
    const blocks = parsePolicyText(text);
    expect(blocks.filter((b) => b.type === 'heading').map((b) => (b as { text: string }).text)).toEqual([
      '1. Quais dados coletamos',
      '2. Para que usamos os dados',
      '3. Compartilhamento',
      '4. Por quanto tempo guardamos',
      '5. Seus direitos',
      '6. Contato',
    ]);
    expect(blocks.filter((b) => b.type === 'list')).toHaveLength(3);
    expect(text.length).toBeLessThan(PRIVACY_TEXT_MAX);
  });
});

describe('modelo de política de privacidade', () => {
  it('usa só os dados oficiais da empresa (nome, CNPJ, e-mail, WhatsApp, endereço) e a data informada', () => {
    const text = buildPrivacyTemplate(company, '26/09/2026');
    expect(text).toContain('LA Motores e Bombas (CNPJ 31.127.662/0001-50)');
    expect(text).toContain('- lamotoreseletricos@gmail.com');
    expect(text).toContain('- WhatsApp/telefone: (81) 99640-5805');
    expect(text).toContain('- Rua Serafim Luiz Pinto, 15 - Jaboatão dos Guararapes - PE');
    expect(text.trimEnd().endsWith('Última atualização: 26/09/2026')).toBe(true);
  });

  it('descreve o que o sistema realmente faz e não promete o que ele não faz', () => {
    const text = buildPrivacyTemplate(company, '26/09/2026');
    expect(text).toMatch(/nome, telefone\/WhatsApp, e-mail \(opcional\)/);
    expect(text).toMatch(/endereço IP/);
    expect(text).toMatch(/carrinho de compras fica salvo apenas no seu navegador/);
    expect(text).toMatch(/Não vendemos os seus dados/);
    // nada de cartão, cookies de rastreamento, anúncios ou outros recursos que o site não tem
    expect(text).not.toMatch(/cart[aã]o de cr[eé]dito|cookies? de terceiros|publicidade|google analytics|pixel/i);
  });

  it('sem CNPJ ou contatos cadastrados, o texto continua coerente (nada é inventado)', () => {
    const bare = buildPrivacyTemplate({ name: 'Empresa Exemplo', hours: OFFICIAL_HOURS }, '01/01/2027');
    expect(bare).toContain('a Empresa Exemplo trata');
    expect(bare).not.toContain('CNPJ');
    expect(bare).toContain('- (informe aqui os contatos da empresa)');
  });
});

describe('validação da política de privacidade', () => {
  it('vazio (ou só espaços) vira null: a página some do site', () => {
    expect(privacyPolicySchema.parse({ privacyText: '' }).privacyText).toBeNull();
    expect(privacyPolicySchema.parse({ privacyText: '   \n  ' }).privacyText).toBeNull();
    expect(privacyPolicySchema.parse({}).privacyText).toBeNull();
  });

  it('texto é aparado e tem limite de tamanho', () => {
    expect(privacyPolicySchema.parse({ privacyText: '  Texto  ' }).privacyText).toBe('Texto');
    expect(privacyPolicySchema.safeParse({ privacyText: 'a'.repeat(PRIVACY_TEXT_MAX) }).success).toBe(true);
    expect(privacyPolicySchema.safeParse({ privacyText: 'a'.repeat(PRIVACY_TEXT_MAX + 1) }).success).toBe(false);
  });
});

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { OFFICIAL_WHATSAPP_TEMPLATES, storeOrderTemplate } from '@/config/company-defaults';
import { ALL_PERMISSIONS, DEFAULT_ROLES } from '@/config/permissions';
import {
  allowedNextStatuses,
  CART_MAX_LINES,
  CART_MAX_QTY,
  customerStatusLabel,
  customerStatusMessage,
  DEMO_STORE_STOCK,
  isFinalStoreStatus,
  storeFlow,
  storePaymentLabel,
  STORE_ORDER_STATUS_KEYS,
} from '@/config/store';
import { formatStoreOrderCode, parseStoreOrderCode } from '@/lib/codes';
import { parseCartField, sanitizeCartInput } from '@/lib/store-cart';
import { computeStorePricing, parseProductParam, productPath } from '@/lib/store-pricing';
import { whatsappTemplatesSchema } from '@/lib/validation/settings';
import { checkoutSchema, storeSettingsSchema } from '@/lib/validation/store';

describe('preço e disponibilidade na loja', () => {
  const base = { salePriceCents: 5000, demoPriceCents: null, stock: 10, sellOnline: true };

  it('preço real disponível: pode comprar até o estoque', () => {
    expect(computeStorePricing(base)).toMatchObject({ priceCents: 5000, isDemoPrice: false, available: 10, purchasable: true, state: 'AVAILABLE' });
  });

  it('poucas unidades reais avisam "últimas unidades"; sem estoque fica esgotado (nunca negativo)', () => {
    expect(computeStorePricing({ ...base, stock: 3 })).toMatchObject({ purchasable: true, state: 'LAST_UNITS', available: 3 });
    expect(computeStorePricing({ ...base, stock: 0 })).toMatchObject({ purchasable: false, state: 'OUT_OF_STOCK', available: 0 });
    expect(computeStorePricing({ ...base, stock: -4 })).toMatchObject({ purchasable: false, state: 'OUT_OF_STOCK', available: 0 });
  });

  it('sem preço nenhum é "consultar valor": nenhum preço é inventado', () => {
    expect(computeStorePricing({ ...base, salePriceCents: 0 })).toMatchObject({ priceCents: null, purchasable: false, state: 'CONSULT' });
  });

  it('preço de demonstração só vale sem preço real, tem estoque de demonstração e é sinalizado', () => {
    expect(computeStorePricing({ salePriceCents: 0, demoPriceCents: 4200, stock: 0, sellOnline: true })).toMatchObject({
      priceCents: 4200,
      isDemoPrice: true,
      available: DEMO_STORE_STOCK,
      purchasable: true,
      state: 'AVAILABLE',
    });
    // o preço real sempre vence o de demonstração
    expect(computeStorePricing({ ...base, demoPriceCents: 1 })).toMatchObject({ priceCents: 5000, isDemoPrice: false });
  });

  it('produto que não é vendido online, ou loja fechada, só oferece consulta', () => {
    expect(computeStorePricing({ ...base, sellOnline: false })).toMatchObject({ purchasable: false, state: 'CONSULT', priceCents: 5000 });
    expect(computeStorePricing(base, false)).toMatchObject({ purchasable: false, state: 'CONSULT' });
  });

  it('endereço do produto tem o id e um apelido legível; o id é extraído de volta', () => {
    expect(productPath(12, 'Capacitor eletrolítico')).toBe('/loja/produto/12-capacitor-eletrolitico');
    expect(productPath(3, '***')).toBe('/loja/produto/3');
    expect(parseProductParam('12-capacitor-eletrolitico')).toBe(12);
    expect(parseProductParam('7')).toBe(7);
    expect(parseProductParam('abc')).toBeNull();
    expect(parseProductParam('0-x')).toBeNull();
    expect(parseProductParam('-5')).toBeNull();
  });
});

describe('carrinho enviado pelo navegador', () => {
  it('junta repetidos, limita a quantidade e ignora lixo', () => {
    expect(
      sanitizeCartInput([
        { id: 1, qty: 2 },
        { id: 1, qty: 3 },
        { id: '2', qty: '4' },
        { id: -1, qty: 1 },
        { id: 3, qty: 0 },
        { id: 4, qty: 1000 },
        { id: 5.7, qty: 1 },
        null,
        'x',
        { qty: 1 },
        { id: 6, qty: 'abc' },
      ]),
    ).toEqual([
      { id: 1, qty: 5 },
      { id: 2, qty: 4 },
      { id: 3, qty: 1 },
      { id: 4, qty: CART_MAX_QTY },
    ]);
    expect(sanitizeCartInput('não é lista')).toEqual([]);
    expect(sanitizeCartInput(undefined)).toEqual([]);
  });

  it('limita o número de linhas', () => {
    const many = Array.from({ length: CART_MAX_LINES + 20 }, (_, i) => ({ id: i + 1, qty: 1 }));
    expect(sanitizeCartInput(many)).toHaveLength(CART_MAX_LINES);
  });

  it('campo de formulário: JSON válido vira carrinho; inválido ou enorme vira carrinho vazio', () => {
    expect(parseCartField('[{"id":5,"qty":2}]')).toEqual([{ id: 5, qty: 2 }]);
    expect(parseCartField('{quebrado')).toEqual([]);
    expect(parseCartField(null)).toEqual([]);
    expect(parseCartField('['.repeat(5000))).toEqual([]);
  });
});

describe('fluxo do pedido', () => {
  it('retirada: recebido → confirmado → pronto → concluído; entrega inclui "saiu para entrega"', () => {
    expect(storeFlow('PICKUP')).toEqual(['RECEIVED', 'CONFIRMED', 'READY', 'COMPLETED']);
    expect(storeFlow('DELIVERY')).toEqual(['RECEIVED', 'CONFIRMED', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED']);
  });

  it('só avança; status final não tem próximo; "saiu para entrega" não existe na retirada', () => {
    expect(allowedNextStatuses('RECEIVED', 'PICKUP')).toEqual(['CONFIRMED', 'READY', 'COMPLETED']);
    expect(allowedNextStatuses('READY', 'PICKUP')).toEqual(['COMPLETED']);
    expect(allowedNextStatuses('READY', 'DELIVERY')).toEqual(['OUT_FOR_DELIVERY', 'COMPLETED']);
    expect(allowedNextStatuses('COMPLETED', 'PICKUP')).toEqual([]);
    expect(allowedNextStatuses('CANCELED', 'DELIVERY')).toEqual([]);
    expect(allowedNextStatuses('OUT_FOR_DELIVERY', 'PICKUP')).toEqual([]);
    expect(STORE_ORDER_STATUS_KEYS.filter(isFinalStoreStatus)).toEqual(['COMPLETED', 'CANCELED']);
  });

  it('textos para o cliente mudam conforme retirada ou entrega', () => {
    expect(customerStatusLabel('READY', 'PICKUP')).toBe('Pronto para retirada');
    expect(customerStatusLabel('READY', 'DELIVERY')).toBe('Pronto para entrega');
    expect(customerStatusLabel('COMPLETED', 'PICKUP')).toBe('Retirado');
    expect(customerStatusLabel('COMPLETED', 'DELIVERY')).toBe('Entregue');
    expect(customerStatusMessage('CANCELED', 'PICKUP')).toBe('Pedido cancelado.');
    expect(storePaymentLabel('PIX', 'PICKUP')).toBe('PIX');
    expect(storePaymentLabel('ON_SITE', 'PICKUP')).toBe('Pagar na retirada');
    expect(storePaymentLabel('ON_SITE', 'DELIVERY')).toBe('Pagar na entrega');
  });

  it('código do pedido: LJ-000012, com leitura tolerante na busca', () => {
    expect(formatStoreOrderCode(12)).toBe('LJ-000012');
    expect(parseStoreOrderCode('LJ-000012')).toBe(12);
    expect(parseStoreOrderCode('lj12')).toBe(12);
    expect(parseStoreOrderCode('pedido #7')).toBe(7);
    expect(parseStoreOrderCode('12')).toBeNull();
    expect(parseStoreOrderCode('OS-000012')).toBeNull();
  });
});

describe('permissões da loja', () => {
  it('o administrador tem tudo; o vendedor atende os pedidos, mas não altera configurações', () => {
    expect(ALL_PERMISSIONS).toContain('store.view');
    expect(ALL_PERMISSIONS).toContain('store.manage');
    const seller = DEFAULT_ROLES.find((r) => r.key === 'seller')!;
    expect(seller.permissions).toEqual(expect.arrayContaining(['store.view', 'store.manage']));
    expect(seller.permissions).not.toContain('settings.manage');
    expect(seller.permissions).not.toContain('sales.cancel');
  });

  it('a migração dá as permissões da loja ao vendedor já existente, sem duplicar (idempotente)', () => {
    const sql = fs.readFileSync(path.resolve('drizzle/0001_store.sql'), 'utf8');
    const updates = sql.split('--> statement-breakpoint').map((s) => s.trim()).filter((s) => s.startsWith('UPDATE `roles`'));
    expect(updates).toHaveLength(2);
    expect(updates.join('\n')).toContain("`key` = 'seller'");
    expect(updates.join('\n')).toContain('store.view');
    expect(updates.join('\n')).toContain('store.manage');
  });
});

describe('validação do checkout', () => {
  const valid = { name: 'Maria Souza', phone: '(81) 99640-5805', email: '', fulfillment: 'PICKUP', paymentMethod: 'PIX', notes: '' };

  it('retirada só precisa de nome, telefone válido e escolhas', () => {
    const parsed = checkoutSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.email).toBeNull();
      expect(parsed.data.notes).toBeNull();
    }
  });

  it('recusa nome curto, telefone inválido, e-mail inválido e escolhas ausentes', () => {
    const result = checkoutSchema.safeParse({ ...valid, name: 'Al', phone: '123', email: 'x', fulfillment: '', paymentMethod: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toEqual(expect.arrayContaining(['name', 'phone', 'email', 'fulfillment', 'paymentMethod']));
    }
  });

  it('entrega exige o endereço completo com CEP de 8 números e UF de 2 letras', () => {
    const missing = checkoutSchema.safeParse({ ...valid, fulfillment: 'DELIVERY' });
    expect(missing.success).toBe(false);
    if (!missing.success) expect(missing.error.issues.map((i) => i.path[0])).toEqual(expect.arrayContaining(['zip', 'street', 'number', 'district', 'city', 'state']));

    const bad = checkoutSchema.safeParse({ ...valid, fulfillment: 'DELIVERY', zip: '123', street: 'Rua A', number: '1', district: 'Centro', city: 'Recife', state: 'PER' });
    expect(bad.success).toBe(false);

    const ok = checkoutSchema.safeParse({ ...valid, fulfillment: 'DELIVERY', zip: '50000-000', street: 'Rua A', number: '1', district: 'Centro', city: 'Recife', state: 'pe' });
    expect(ok.success).toBe(true);
  });
});

describe('validação das configurações da loja', () => {
  const base = { enabled: 'on', pixKeyType: '', pixKey: '', deliveryEnabled: '', deliveryFeeCents: '0', freeDeliveryMinCents: '', minOrderCents: '0', holdHours: '24', deliveryNote: '', pickupNote: '', policyText: '' };

  it('sem chave PIX está tudo bem (a loja só não oferece PIX)', () => {
    const parsed = storeSettingsSchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toMatchObject({ enabled: true, pixKey: null, pixKeyType: null, deliveryEnabled: false, freeDeliveryMinCents: null, holdHours: 24 });
  });

  it('a chave PIX é validada e normalizada conforme o tipo escolhido', () => {
    const ok = storeSettingsSchema.safeParse({ ...base, pixKeyType: 'PHONE', pixKey: '(81) 99640-5805' });
    expect(ok.success && ok.data.pixKey).toBe('+5581996405805');
    const invalid = storeSettingsSchema.safeParse({ ...base, pixKeyType: 'CPF', pixKey: '123' });
    expect(invalid.success).toBe(false);
    const noType = storeSettingsSchema.safeParse({ ...base, pixKey: 'a@b.co' });
    expect(noType.success).toBe(false);
  });

  it('entrega grátis a partir de 0 significa "nunca"; prazo de espera limitado a 30 dias', () => {
    const parsed = storeSettingsSchema.safeParse({ ...base, freeDeliveryMinCents: '0' });
    expect(parsed.success && parsed.data.freeDeliveryMinCents).toBeNull();
    const withMin = storeSettingsSchema.safeParse({ ...base, freeDeliveryMinCents: '15000' });
    expect(withMin.success && withMin.data.freeDeliveryMinCents).toBe(15000);
    expect(storeSettingsSchema.safeParse({ ...base, holdHours: '721' }).success).toBe(false);
    expect(storeSettingsSchema.safeParse({ ...base, holdHours: '-1' }).success).toBe(false);
  });
});

describe('mensagem do WhatsApp sobre o pedido', () => {
  const { storeOrder: _ignored, ...oldTemplates } = OFFICIAL_WHATSAPP_TEMPLATES;

  it('perfis salvos antes da loja (sem o modelo) usam o padrão; modelo editado tem prioridade', () => {
    expect(storeOrderTemplate(oldTemplates)).toBe(OFFICIAL_WHATSAPP_TEMPLATES.storeOrder);
    expect(storeOrderTemplate({ ...oldTemplates, storeOrder: '   ' })).toBe(OFFICIAL_WHATSAPP_TEMPLATES.storeOrder);
    expect(storeOrderTemplate({ ...oldTemplates, storeOrder: 'Olá, {{nome}}! {{link}}' })).toBe('Olá, {{nome}}! {{link}}');
    for (const placeholder of ['{{nome}}', '{{empresa}}', '{{codigo}}', '{{link}}']) expect(OFFICIAL_WHATSAPP_TEMPLATES.storeOrder).toContain(placeholder);
  });

  it('o formulário de mensagens exige o novo modelo', () => {
    const complete = { ...OFFICIAL_WHATSAPP_TEMPLATES };
    expect(whatsappTemplatesSchema.safeParse(complete).success).toBe(true);
    expect(whatsappTemplatesSchema.safeParse({ ...complete, storeOrder: '' }).success).toBe(false);
  });
});

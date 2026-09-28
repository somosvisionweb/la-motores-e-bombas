import { z } from 'zod';
import { PAYMENT_METHOD_KEYS } from '@/config/payment-methods';
import { FULFILLMENT_KEYS, PIX_KEY_TYPES, STORE_PAYMENT_KEYS, STORE_ORDER_STATUS_KEYS } from '@/config/store';
import { isValidPhoneBR } from '../phone';
import { normalizePixKey } from '../pix';
import { centsField, checkbox, optionalText, requiredText } from './common';

const emptyToNull = (v: string | undefined) => (v ? v : null);

const optionalField = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .optional()
    .transform(emptyToNull);

/** Checkout público. `items` (carrinho) e os campos de controle anti-robô são tratados na ação. */
export const checkoutSchema = z
  .object({
    name: requiredText('Nome', 120).refine((v) => v.length >= 3, 'Informe seu nome completo.'),
    phone: requiredText('WhatsApp ou telefone', 30).refine((v) => isValidPhoneBR(v), 'Informe um telefone com DDD, ex.: (81) 99999-9999.'),
    email: z
      .string()
      .trim()
      .max(120, 'Use no máximo 120 caracteres.')
      .optional()
      .transform(emptyToNull)
      .refine((v) => v === null || z.email().safeParse(v).success, 'E-mail inválido.'),
    fulfillment: z.enum(FULFILLMENT_KEYS, { error: 'Escolha como quer receber o pedido.' }),
    paymentMethod: z.enum(STORE_PAYMENT_KEYS, { error: 'Escolha a forma de pagamento.' }),
    zip: optionalField(12),
    street: optionalField(120),
    number: optionalField(20),
    complement: optionalField(80),
    district: optionalField(80),
    city: optionalField(80),
    state: optionalField(2),
    notes: optionalText(300),
    acceptTerms: checkbox(),
  })
  .superRefine((data, ctx) => {
    if (data.fulfillment !== 'DELIVERY') return;
    const required: [keyof typeof data, string][] = [
      ['zip', 'Informe o CEP.'],
      ['street', 'Informe a rua.'],
      ['number', 'Informe o número (ou "s/n").'],
      ['district', 'Informe o bairro.'],
      ['city', 'Informe a cidade.'],
      ['state', 'Informe o estado (sigla).'],
    ];
    for (const [key, message] of required) {
      if (!data[key]) ctx.addIssue({ code: 'custom', path: [key], message });
    }
    if (data.zip && data.zip.replace(/\D/g, '').length !== 8) ctx.addIssue({ code: 'custom', path: ['zip'], message: 'CEP inválido (8 números).' });
    if (data.state && !/^[A-Za-z]{2}$/.test(data.state)) ctx.addIssue({ code: 'custom', path: ['state'], message: 'Use a sigla do estado (2 letras).' });
  });
export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** Configurações da loja virtual (Configurações → Loja virtual). */
export const storeSettingsSchema = z
  .object({
    enabled: checkbox(),
    pixKeyType: z
      .string()
      .trim()
      .optional()
      .transform(emptyToNull)
      .refine((v) => v === null || (PIX_KEY_TYPES as readonly string[]).includes(v), 'Tipo de chave inválido.'),
    pixKey: optionalField(120),
    deliveryEnabled: checkbox(),
    deliveryFeeCents: centsField('Taxa de entrega'),
    freeDeliveryMinCents: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? Number(v) : null))
      .refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 1_000_000_000), 'Valor inválido.')
      .transform((v) => (v === 0 ? null : v)),
    deliveryNote: optionalText(300),
    pickupNote: optionalText(300),
    minOrderCents: centsField('Pedido mínimo'),
    holdHours: z.coerce
      .number({ error: 'Informe o prazo em horas.' })
      .int('Use um número inteiro de horas.')
      .min(0, 'Não pode ser negativo.')
      .max(720, 'O máximo é 720 horas (30 dias).'),
    policyText: optionalText(2000),
  })
  .superRefine((data, ctx) => {
    if (data.pixKey && !data.pixKeyType) ctx.addIssue({ code: 'custom', path: ['pixKeyType'], message: 'Escolha o tipo da chave PIX.' });
    if (data.pixKey && data.pixKeyType && normalizePixKey(data.pixKeyType as (typeof PIX_KEY_TYPES)[number], data.pixKey) === null) {
      ctx.addIssue({ code: 'custom', path: ['pixKey'], message: 'Chave PIX inválida para o tipo escolhido.' });
    }
  })
  .transform((data) => ({
    ...data,
    pixKeyType: data.pixKey ? (data.pixKeyType as (typeof PIX_KEY_TYPES)[number]) : null,
    pixKey: data.pixKey ? normalizePixKey(data.pixKeyType as (typeof PIX_KEY_TYPES)[number], data.pixKey) : null,
  }));
export type StoreSettingsInput = z.infer<typeof storeSettingsSchema>;

export const storeStatusSchema = z.object({
  status: z.enum(STORE_ORDER_STATUS_KEYS.filter((s) => s !== 'CANCELED') as ['RECEIVED', 'CONFIRMED', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED'], { error: 'Status inválido.' }),
  paymentMethod: z
    .string()
    .trim()
    .optional()
    .transform(emptyToNull)
    .refine((v) => v === null || (PAYMENT_METHOD_KEYS as readonly string[]).includes(v), 'Forma de pagamento inválida.'),
});

export const storeCancelSchema = z.object({ reason: optionalText(300) });

export const storeNoteSchema = z.object({
  message: requiredText('Observação', 500),
  isPublic: checkbox(),
});

import { z } from 'zod';
import { WEEKDAY_KEYS, type BusinessHours } from '@/config/company';
import { PAYMENT_METHOD_KEYS } from '@/config/payment-methods';
import { isValidCnpj } from '../document-id';
import { toWhatsAppNumber } from '../phone';
import { PRIVACY_TEXT_MAX } from '../policy-text';
import { optionalText, requiredText } from './common';

const emptyToNull = (v: string | undefined) => (v ? v : null);

export const companyProfileSchema = z.object({
  name: requiredText('Nome da empresa', 120),
  cnpj: z
    .string()
    .trim()
    .optional()
    .transform(emptyToNull)
    .refine((v) => v === null || isValidCnpj(v), 'CNPJ inválido.'),
  email: z
    .string()
    .trim()
    .optional()
    .transform(emptyToNull)
    .refine((v) => v === null || z.email().safeParse(v).success, 'E-mail inválido.'),
  whatsapp: z
    .string()
    .trim()
    .optional()
    .transform(emptyToNull)
    .refine((v) => v === null || toWhatsAppNumber(v) !== null, 'Informe o número com DDD, ex.: (81) 99999-9999.')
    .transform((v) => (v === null ? null : toWhatsAppNumber(v))),
  phone: optionalText(30),
  address: optionalText(200),
  city: optionalText(100),
  state: z
    .string()
    .trim()
    .optional()
    .transform(emptyToNull)
    .refine((v) => v === null || /^[A-Za-z]{2}$/.test(v), 'Use a sigla do estado (2 letras).')
    .transform((v) => (v === null ? null : v.toUpperCase())),
  zip: optionalText(12),
  instagram: optionalText(100),
  publicBaseUrl: z
    .string()
    .trim()
    .optional()
    .transform(emptyToNull)
    .refine((v) => v === null || /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(v), 'Informe uma URL completa, ex.: https://www.seusite.com.br')
    .transform((v) => (v === null ? null : v.replace(/\/+$/, ''))),
});
export type CompanyProfileInput = z.infer<typeof companyProfileSchema>;

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Lê os campos `mon_open`, `mon_close`, `mon_closed`… do formulário de horários. */
export function parseBusinessHours(values: Record<string, unknown>): { hours?: BusinessHours; errors?: Record<string, string> } {
  const hours = {} as BusinessHours;
  const errors: Record<string, string> = {};
  for (const day of WEEKDAY_KEYS) {
    const closed = values[`${day}_closed`] === 'on' || values[`${day}_closed`] === 'true';
    const open = String(values[`${day}_open`] ?? '').trim();
    const close = String(values[`${day}_close`] ?? '').trim();
    if (closed) {
      hours[day] = { closed: true, open: null, close: null };
      continue;
    }
    if (!TIME_RE.test(open) || !TIME_RE.test(close)) {
      errors[`${day}_open`] = 'Informe abertura e fechamento (HH:MM) ou marque como fechado.';
      continue;
    }
    if (open >= close) {
      errors[`${day}_close`] = 'O fechamento deve ser depois da abertura.';
      continue;
    }
    hours[day] = { closed: false, open, close };
  }
  return Object.keys(errors).length ? { errors } : { hours };
}

export const paymentMethodsSchema = z.object({
  paymentMethods: z
    .union([z.enum(PAYMENT_METHOD_KEYS), z.array(z.enum(PAYMENT_METHOD_KEYS))])
    .transform((v) => (Array.isArray(v) ? v : [v]))
    .refine((v) => v.length > 0, 'Selecione ao menos uma forma de pagamento.'),
});

export const whatsappTemplatesSchema = z.object({
  general: requiredText('Mensagem de contato geral', 500),
  attendance: requiredText('Mensagem de atendimento', 500),
  quote: requiredText('Mensagem de orçamento', 500),
  homeVisit: requiredText('Mensagem de atendimento a domicílio', 500),
  orderShare: requiredText('Mensagem de envio da OS', 800),
  storeOrder: requiredText('Mensagem sobre pedido da loja', 800),
});

export const seoSchema = z.object({
  seoTitle: requiredText('Título do site', 80),
  seoDescription: requiredText('Descrição do site', 200),
});

/** Política de privacidade (texto simples exibido em /privacidade); vazio remove a página do site. */
export const privacyPolicySchema = z.object({
  privacyText: optionalText(PRIVACY_TEXT_MAX),
});

export const guaranteeTermsSchema = z.object({
  title: requiredText('Título', 120),
  warrantyMonths: z.coerce
    .number({ error: 'Informe o prazo em meses.' })
    .int('Informe um número inteiro de meses.')
    .min(1, 'O prazo mínimo é 1 mês.')
    .max(60, 'O prazo máximo é 60 meses.'),
  content: z
    .string()
    .trim()
    .min(20, 'Informe o texto dos termos.')
    .max(20_000, 'Texto muito longo (máximo de 20.000 caracteres).'),
});
export type GuaranteeTermsInput = z.infer<typeof guaranteeTermsSchema>;

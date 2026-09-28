import { z } from 'zod';
import { isISODate } from '../dates';

// Mensagens padrão do Zod em português.
z.config(z.locales.pt());

/** Texto opcional: vazio vira null. */
export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .optional()
    .transform((value) => (value ? value : null));

export const requiredText = (label: string, max = 200) =>
  z
    .string({ error: `${label} é obrigatório.` })
    .trim()
    .min(1, `${label} é obrigatório.`)
    .max(max, `Use no máximo ${max} caracteres.`);

/** Data ISO (YYYY-MM-DD) obrigatória. */
export const requiredDate = (label = 'Data') =>
  z.string({ error: `${label} é obrigatória.` }).refine((v) => isISODate(v), `${label} inválida.`);

/** Data ISO opcional: vazio vira null. */
export const optionalDate = (label = 'Data') =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || isISODate(v), `${label} inválida.`);

/** Valor em centavos (inteiro ≥ 0). O formulário envia centavos, não reais. */
export const centsField = (label = 'Valor', max = 1_000_000_000) =>
  z.coerce
    .number({ error: `${label} inválido.` })
    .int(`${label} inválido.`)
    .min(0, `${label} não pode ser negativo.`)
    .max(max, `${label} muito alto.`);

export const positiveCentsField = (label = 'Valor') =>
  centsField(label).refine((v) => v > 0, `${label} deve ser maior que zero.`);

export const quantityField = (label = 'Quantidade') =>
  z.coerce
    .number({ error: `${label} inválida.` })
    .int(`${label} deve ser um número inteiro.`)
    .min(1, `${label} deve ser pelo menos 1.`)
    .max(100_000, `${label} muito alta.`);

export const idField = (label = 'Registro') =>
  z.coerce.number({ error: `${label} inválido.` }).int().positive(`${label} inválido.`);

export const optionalId = () =>
  z
    .union([z.literal(''), z.coerce.number().int().positive()])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v));

/** Checkbox de formulário HTML: "on"/"true" → true. */
export const checkbox = () =>
  z
    .union([z.literal('on'), z.literal('true'), z.literal('1'), z.literal('false'), z.literal('0'), z.literal('')])
    .optional()
    .transform((v) => v === 'on' || v === 'true' || v === '1');

/** Converte FormData em objeto simples (campos repetidos viram arrays). */
export function formDataToObject(formData: FormData): Record<string, string | string[] | File> {
  const result: Record<string, string | string[] | File> = {};
  for (const key of new Set(formData.keys())) {
    const all = formData.getAll(key);
    result[key] = all.length > 1 ? all.map(String) : (all[0] as string | File);
  }
  return result;
}

/** Valores do formulário como strings (para reexibir após erro de validação). Senhas nunca são devolvidas. */
export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string' && !key.startsWith('$ACTION') && !/password|senha/i.test(key)) values[key] = value;
  }
  return values;
}

/** Primeiro erro de cada campo: { "name": "Nome é obrigatório." }. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!(key in errors)) errors[key] = issue.message;
  }
  return errors;
}

import { z } from 'zod';
import { isProductIconKey } from '@/config/product-icons';
import { centsField, checkbox, optionalText, requiredText } from './common';

const emptyToNull = (v: string | undefined) => (v ? v : null);

export const productSchema = z.object({
  name: requiredText('Nome do produto', 120),
  code: z
    .string()
    .trim()
    .optional()
    .transform(emptyToNull)
    .refine((v) => v === null || /^[A-Za-z0-9._\-/]{1,30}$/.test(v), 'Use letras, números, ponto, hífen ou barra (máx. 30).')
    .transform((v) => (v === null ? null : v.toUpperCase())),
  category: requiredText('Categoria', 80),
  salePriceCents: centsField('Preço de venda'),
  costCents: centsField('Custo'),
  /** Estoque inicial (usado apenas no cadastro; depois use "Ajustar estoque"). */
  stock: z.coerce.number({ error: 'Estoque inválido.' }).int('Use um número inteiro.').min(0, 'Não pode ser negativo.').max(1_000_000).optional().default(0),
  minStock: z.coerce.number({ error: 'Estoque mínimo inválido.' }).int('Use um número inteiro.').min(0, 'Não pode ser negativo.').max(1_000_000).optional().default(0),
  unit: requiredText('Unidade', 12),
  notes: optionalText(500),
  iconKey: z
    .string()
    .trim()
    .optional()
    .transform(emptyToNull)
    .refine((v) => v === null || isProductIconKey(v), 'Ícone inválido.'),
  isActive: checkbox(),
  showOnSite: checkbox(),
  sellOnline: checkbox(),
  storeDescription: optionalText(600),
});
export type ProductFormInput = z.infer<typeof productSchema>;

/** Cadastro rápido de item na loja: só o essencial (o resto pode ser completado depois, na ficha do produto). */
export const quickProductSchema = z.object({
  name: requiredText('Nome do item', 120),
  category: requiredText('Categoria', 80),
  salePriceCents: centsField('Preço de venda'),
  stock: z.coerce.number({ error: 'Estoque inválido.' }).int('Use um número inteiro.').min(0, 'Não pode ser negativo.').max(1_000_000).optional().default(0),
});

export const stockAdjustSchema = z.object({
  mode: z.enum(['ADD', 'REMOVE', 'SET'], { error: 'Escolha o tipo de ajuste.' }),
  quantity: z.coerce.number({ error: 'Informe a quantidade.' }).int('Use um número inteiro.').min(0, 'Não pode ser negativa.').max(1_000_000, 'Quantidade muito alta.'),
  note: optionalText(200),
});
export type StockAdjustInput = z.infer<typeof stockAdjustSchema>;

const nullableCents = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? Number(v) : null))
  .refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 1_000_000_000), 'Valor inválido.');

export const serviceSchema = z.object({
  name: requiredText('Nome do serviço', 140),
  category: requiredText('Categoria', 60),
  description: optionalText(400),
  defaultPriceCents: nullableCents,
  isActive: checkbox(),
  showOnSite: checkbox(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
});
export type ServiceFormInput = z.infer<typeof serviceSchema>;

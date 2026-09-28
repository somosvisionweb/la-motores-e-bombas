import { z } from 'zod';
import { PAYMENT_METHOD_KEYS } from '@/config/payment-methods';
import { computeOrderTotals } from '../order-totals';
import { centsField, checkbox, optionalText, quantityField, requiredDate, requiredText } from './common';

const idOrNull = z
  .union([z.literal(''), z.null(), z.coerce.number().int().positive()])
  .optional()
  .transform((v) => (v === '' || v === null || v === undefined ? null : v));

export const saleItemSchema = z.object({
  productId: idOrNull,
  description: requiredText('Descrição do item', 200),
  quantity: quantityField('Quantidade'),
  unitPriceCents: centsField('Valor'),
});

export const saleSchema = z
  .object({
    customerId: idOrNull,
    saleDate: requiredDate('Data da venda'),
    discountCents: centsField('Desconto').optional().default(0),
    notes: optionalText(1000),
    items: z.array(saleItemSchema).min(1, 'Adicione ao menos um item à venda.').max(60, 'Use no máximo 60 itens por venda.'),
    /** "Receber agora": registra o pagamento junto com a venda. */
    payNow: checkbox(),
    paymentMethod: z
      .union([z.enum(PAYMENT_METHOD_KEYS), z.literal(''), z.null()])
      .optional()
      .transform((v) => (v ? v : null)),
  })
  .superRefine((value, ctx) => {
    const totals = computeOrderTotals(value.items.map((i) => ({ kind: 'PART' as const, quantity: i.quantity, unitPriceCents: i.unitPriceCents })), 0);
    if (value.discountCents > totals.subtotalCents) {
      ctx.addIssue({ code: 'custom', path: ['discountCents'], message: 'O desconto não pode ser maior que o total dos itens.' });
    }
    if (value.payNow && !value.paymentMethod) {
      ctx.addIssue({ code: 'custom', path: ['paymentMethod'], message: 'Escolha a forma de pagamento.' });
    }
  });

export type SaleFormInput = z.infer<typeof saleSchema>;

export const cancelSaleSchema = z.object({
  reason: z.string().trim().max(300).optional().transform((v) => (v ? v : null)),
});

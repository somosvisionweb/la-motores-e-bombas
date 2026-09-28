import { z } from 'zod';
import { ITEM_KIND_KEYS, PAYMENT_METHOD_KEYS } from '@/config/payment-methods';
import { ORDER_STATUS_KEYS } from '@/config/order-status';
import { computeOrderTotals } from '../order-totals';
import { centsField, idField, optionalDate, optionalText, quantityField, requiredDate, requiredText } from './common';

const idOrNull = z
  .union([z.literal(''), z.null(), z.coerce.number().int().positive()])
  .optional()
  .transform((v) => (v === '' || v === null || v === undefined ? null : v));

export const orderItemSchema = z.object({
  kind: z.enum(ITEM_KIND_KEYS),
  serviceId: idOrNull,
  productId: idOrNull,
  description: requiredText('Descrição do item', 200),
  quantity: quantityField('Quantidade'),
  unitPriceCents: centsField('Valor'),
});

export const orderSchema = z
  .object({
    customerId: idField('Cliente'),
    status: z.enum(ORDER_STATUS_KEYS).optional(),
    equipment: requiredText('Equipamento', 120),
    brand: optionalText(80),
    model: optionalText(80),
    problemDescription: optionalText(2000),
    diagnosis: optionalText(2000),
    serviceDescription: optionalText(2000),
    entryDate: requiredDate('Data de entrada'),
    expectedDeliveryDate: optionalDate('Previsão de entrega'),
    deliveredDate: optionalDate('Data de entrega'),
    nextServiceDate: optionalDate('Data do próximo serviço'),
    technicianId: idOrNull,
    paymentMethod: z
      .union([z.enum(PAYMENT_METHOD_KEYS), z.literal(''), z.null()])
      .optional()
      .transform((v) => (v ? v : null)),
    discountCents: centsField('Desconto').optional().default(0),
    notes: optionalText(2000),
    items: z.array(orderItemSchema).max(60, 'Use no máximo 60 itens por ordem.'),
  })
  .superRefine((value, ctx) => {
    if (value.expectedDeliveryDate && value.expectedDeliveryDate < value.entryDate) {
      ctx.addIssue({ code: 'custom', path: ['expectedDeliveryDate'], message: 'A previsão não pode ser anterior à data de entrada.' });
    }
    const totals = computeOrderTotals(value.items, 0);
    if (value.discountCents > totals.subtotalCents) {
      ctx.addIssue({ code: 'custom', path: ['discountCents'], message: 'O desconto não pode ser maior que o total dos itens.' });
    }
  });

export type OrderFormInput = z.infer<typeof orderSchema>;

/** O formulário da OS envia todos os campos como JSON no campo "payload". */
export function parseOrderPayload(raw: FormDataEntryValue | null): unknown {
  if (typeof raw !== 'string' || !raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export const statusChangeSchema = z.object({
  status: z.enum(ORDER_STATUS_KEYS, { error: 'Escolha o novo status.' }),
  note: optionalText(500),
});

export const orderNoteSchema = z.object({
  message: z.string({ error: 'Escreva o comentário.' }).trim().min(1, 'Escreva o comentário.').max(1000),
});

import { z } from 'zod';
import { PAYMENT_METHOD_KEYS } from '@/config/payment-methods';
import { optionalText, positiveCentsField, requiredDate } from './common';

export const paymentSchema = z.object({
  amountCents: positiveCentsField('Valor'),
  method: z.enum(PAYMENT_METHOD_KEYS, { error: 'Escolha a forma de pagamento.' }),
  paidDate: requiredDate('Data do pagamento'),
  description: optionalText(200),
  notes: optionalText(500),
});
export type PaymentFormInput = z.infer<typeof paymentSchema>;

/** Entrada avulsa (sem OS/venda): descrição é obrigatória e o cliente é opcional. */
export const standalonePaymentSchema = paymentSchema
  .omit({ description: true })
  .extend({
    description: z.string({ error: 'Informe a descrição.' }).trim().min(1, 'Informe a descrição.').max(200),
    customerId: z
      .union([z.literal(''), z.coerce.number().int().positive()])
      .optional()
      .transform((v) => (v === '' || v === undefined ? null : v)),
  });

export const voidPaymentSchema = z.object({
  reason: z.string({ error: 'Informe o motivo do estorno.' }).trim().min(3, 'Informe o motivo do estorno.').max(300),
});

import { z } from 'zod';
import { PAYMENT_METHOD_KEYS } from '@/config/payment-methods';
import { checkbox, optionalText, positiveCentsField, requiredDate, requiredText } from './common';

export const expenseSchema = z.object({
  date: requiredDate('Data'),
  description: requiredText('Descrição', 200),
  supplier: optionalText(120),
  categoryId: z.coerce.number({ error: 'Escolha a categoria.' }).int().positive('Escolha a categoria.'),
  amountCents: positiveCentsField('Valor'),
  paymentMethod: z
    .union([z.enum(PAYMENT_METHOD_KEYS), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v ? v : null)),
  notes: optionalText(500),
});
export type ExpenseFormInput = z.infer<typeof expenseSchema>;

export const expenseCategorySchema = z.object({
  name: requiredText('Nome da categoria', 60),
  isGoods: checkbox(),
});

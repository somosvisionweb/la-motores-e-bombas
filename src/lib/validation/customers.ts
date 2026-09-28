import { z } from 'zod';
import { isValidCpfOrCnpj } from '../document-id';
import { isValidPhoneBR } from '../phone';
import { checkbox, optionalText, requiredText } from './common';

const emptyToNull = (v: string | undefined) => (v ? v : null);

const optionalPhone = (label: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform(emptyToNull)
    .refine((v) => v === null || isValidPhoneBR(v), `${label} inválido. Informe com DDD, ex.: (81) 99999-9999.`);

export const customerSchema = z.object({
  name: requiredText('Nome', 120),
  phone: optionalPhone('Telefone'),
  whatsapp: optionalPhone('WhatsApp'),
  /** Quando marcado, o WhatsApp é o mesmo número do telefone. */
  whatsappSame: checkbox(),
  document: z
    .string()
    .trim()
    .optional()
    .transform(emptyToNull)
    .refine((v) => v === null || isValidCpfOrCnpj(v), 'CPF/CNPJ inválido.'),
  email: z
    .string()
    .trim()
    .optional()
    .transform(emptyToNull)
    .refine((v) => v === null || z.email().safeParse(v).success, 'E-mail inválido.'),
  address: optionalText(250),
  notes: optionalText(1000),
  /** Confirma o cadastro mesmo havendo cliente com o mesmo telefone. */
  allowDuplicate: checkbox(),
});

export type CustomerFormInput = z.infer<typeof customerSchema>;

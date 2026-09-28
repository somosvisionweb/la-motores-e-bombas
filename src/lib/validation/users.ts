import { z } from 'zod';
import { isPermissionKey } from '@/config/permissions';
import { checkbox, optionalText, requiredText } from './common';

const emptyToNull = (v: string | undefined) => (v ? v : null);

export const userSchema = z.object({
  name: requiredText('Nome', 100),
  username: z
    .string({ error: 'Informe o nome de usuário.' })
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,30}$/, 'Use de 3 a 30 letras minúsculas, números, ponto, hífen ou sublinhado.'),
  email: z
    .string()
    .trim()
    .optional()
    .transform(emptyToNull)
    .refine((v) => v === null || z.email().safeParse(v).success, 'E-mail inválido.'),
  roleId: z.coerce.number({ error: 'Escolha o perfil de acesso.' }).int().positive('Escolha o perfil de acesso.'),
  isActive: checkbox(),
});
export type UserFormInput = z.infer<typeof userSchema>;

export const roleSchema = z.object({
  name: requiredText('Nome do perfil', 60),
  description: optionalText(200),
  permissions: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]))
    .transform((list) => list.filter(isPermissionKey)),
});
export type RoleFormInput = z.infer<typeof roleSchema>;

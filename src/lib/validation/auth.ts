import { z } from 'zod';

export const loginSchema = z.object({
  username: z
    .string({ error: 'Informe o usuário.' })
    .trim()
    .min(1, 'Informe o usuário.')
    .max(60, 'Usuário inválido.')
    .transform((v) => v.toLowerCase()),
  password: z.string({ error: 'Informe a senha.' }).min(1, 'Informe a senha.').max(200, 'Senha inválida.'),
  next: z.string().optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string({ error: 'Informe a senha atual.' }).min(1, 'Informe a senha atual.'),
    newPassword: z.string({ error: 'Informe a nova senha.' }).min(1, 'Informe a nova senha.').max(128),
    confirmPassword: z.string({ error: 'Confirme a nova senha.' }).min(1, 'Confirme a nova senha.'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não conferem.' });

/** Aceita apenas caminhos internos do sistema após o login (evita redirecionamento para sites externos). */
export function sanitizeNextPath(next: string | undefined | null): string {
  if (!next || !next.startsWith('/sistema') || next.includes('//') || next.includes('\\') || next.includes('\n')) return '/sistema';
  return next;
}

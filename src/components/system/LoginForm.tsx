'use client';

import { loginAction } from '@/actions/auth';
import { ActionForm } from '@/components/form/ActionForm';
import { PasswordField, TextField } from '@/components/form/fields';
import { SubmitButton } from '@/components/ui/SubmitButton';

export function LoginForm({ next }: { next: string }) {
  return (
    <ActionForm action={loginAction} className="stack" successToast={false} id="login-form">
      <input type="hidden" name="next" value={next} />
      <TextField name="username" label="Usuário" autoComplete="username" required autoFocus placeholder="ex.: ewerton" />
      <PasswordField name="password" label="Senha" required autoComplete="current-password" />
      <SubmitButton block size="lg" pendingLabel="Entrando…">
        Entrar
      </SubmitButton>
      <p className="text-muted" style={{ fontSize: 13 }}>
        Esqueceu a senha? Peça ao administrador para redefini-la.
      </p>
    </ActionForm>
  );
}

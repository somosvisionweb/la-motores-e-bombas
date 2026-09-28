'use client';

import { changePasswordAction } from '@/actions/auth';
import { ActionForm } from '@/components/form/ActionForm';
import { PasswordField } from '@/components/form/fields';
import { SubmitButton } from '@/components/ui/SubmitButton';

export function ChangePasswordForm({ forced = false }: { forced?: boolean }) {
  return (
    <ActionForm action={changePasswordAction} className="stack" successToast={false}>
      <PasswordField
        name="currentPassword"
        label={forced ? 'Senha temporária' : 'Senha atual'}
        required
        autoComplete="current-password"
        autoFocus={forced}
      />
      <PasswordField
        name="newPassword"
        label="Nova senha"
        required
        autoComplete="new-password"
        hint="Mínimo de 8 caracteres, com letras e números."
      />
      <PasswordField name="confirmPassword" label="Repita a nova senha" required autoComplete="new-password" />
      <SubmitButton size="lg" pendingLabel="Salvando…">
        Salvar nova senha
      </SubmitButton>
    </ActionForm>
  );
}

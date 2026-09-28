import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthLayoutShell } from '@/components/system/AuthPanel';
import { ChangePasswordForm } from '@/components/system/ChangePasswordForm';
import { requireUserAllowingPasswordChange } from '@/server/auth/session';
import { getCompanySettings } from '@/server/services/settings';

export const metadata: Metadata = { title: 'Definir nova senha' };

export default async function ForcedPasswordChangePage() {
  const user = await requireUserAllowingPasswordChange();
  if (!user.mustChangePassword) redirect('/sistema');
  const company = await getCompanySettings();

  return (
    <AuthLayoutShell
      company={company}
      title="Defina sua nova senha"
      subtitle={`Olá, ${user.name.split(' ')[0]}! Por segurança, troque a senha temporária antes de continuar.`}
      showBackLink={false}
    >
      <ChangePasswordForm forced />
    </AuthLayoutShell>
  );
}

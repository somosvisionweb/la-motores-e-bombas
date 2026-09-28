import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthLayoutShell } from '@/components/system/AuthPanel';
import { LoginForm } from '@/components/system/LoginForm';
import { sanitizeNextPath } from '@/lib/validation/auth';
import { firstParam } from '@/lib/query';
import { getSessionUser } from '@/server/auth/session';
import { getCompanySettings } from '@/server/services/settings';

export const metadata: Metadata = { title: 'Entrar' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const user = await getSessionUser();
  if (user) redirect(user.mustChangePassword ? '/trocar-senha' : '/sistema');

  const company = await getCompanySettings();
  const next = sanitizeNextPath(firstParam(params.next));

  return (
    <AuthLayoutShell
      company={company}
      title="Entrar no sistema"
      subtitle="Acesse com o seu usuário e senha para continuar."
    >
      <LoginForm next={next} />
    </AuthLayoutShell>
  );
}

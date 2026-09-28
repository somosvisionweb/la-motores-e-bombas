import { KeyRound, UserRound } from 'lucide-react';
import { ChangePasswordForm } from '@/components/system/ChangePasswordForm';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { PERMISSION_LABEL } from '@/config/permissions';
import { formatDateTimeBR } from '@/lib/dates';
import { requireUser } from '@/server/auth/session';
import { getCompanySettings } from '@/server/services/settings';
import { getUser } from '@/server/services/users';

export const metadata = { title: 'Minha conta' };

export default async function AccountPage() {
  const session = await requireUser();
  const [user, company] = await Promise.all([getUser(session.id), getCompanySettings()]);

  return (
    <div className="page--narrow" style={{ marginInline: 'auto' }}>
      <PageHeader title="Minha conta" subtitle="Seus dados de acesso e segurança." />
      <div className="stack" style={{ ['--gap' as string]: '20px' }}>
        <Card>
          <CardHeader title="Perfil" icon={<UserRound size={20} color="var(--navy-500)" aria-hidden="true" />} />
          <CardBody>
            <dl className="kv">
              <dt>Nome</dt>
              <dd>{session.name}</dd>
              <dt>Usuário</dt>
              <dd className="mono">{session.username}</dd>
              <dt>Perfil de acesso</dt>
              <dd>{session.roleName}</dd>
              <dt>Último acesso</dt>
              <dd>{user?.lastLoginAt ? formatDateTimeBR(user.lastLoginAt, company.timezone) : '—'}</dd>
              <dt>Permissões</dt>
              <dd className="text-muted" style={{ fontSize: 13 }}>
                {session.permissions.map((p) => PERMISSION_LABEL[p] ?? p).join(' · ')}
              </dd>
            </dl>
          </CardBody>
        </Card>
        <Card id="senha">
          <CardHeader title="Alterar senha" subtitle="Ao alterar, os outros dispositivos conectados são desconectados." icon={<KeyRound size={20} color="var(--navy-500)" aria-hidden="true" />} />
          <CardBody>
            <div style={{ maxWidth: 420 }}>
              <ChangePasswordForm />
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

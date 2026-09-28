import Link from 'next/link';
import { Pencil, Plus, ShieldCheck, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { formatDateTimeBR } from '@/lib/dates';
import { initials } from '@/lib/text';
import { requirePagePermission } from '@/server/auth/session';
import { hasPermission } from '@/server/auth/types';
import { getCompanySettings } from '@/server/services/settings';
import { listUsers } from '@/server/services/users';

export const metadata = { title: 'Usuários' };

export default async function UsersPage() {
  const viewer = await requirePagePermission('users.view');
  const [users, company] = await Promise.all([listUsers(), getCompanySettings()]);
  const canManage = hasPermission(viewer, 'users.manage');

  return (
    <>
      <PageHeader
        title="Usuários"
        subtitle="Quem acessa o sistema e o que cada pessoa pode fazer."
        actions={
          canManage ? (
            <Link href="/sistema/usuarios/novo" className="btn btn--primary">
              <Plus aria-hidden="true" /> Novo usuário
            </Link>
          ) : null
        }
      />
      <div style={{ marginBottom: 20 }}>
        <Tabs
          label="Seções de usuários"
          items={[
            { href: '/sistema/usuarios', label: 'Usuários', active: true, icon: <Users aria-hidden="true" /> },
            { href: '/sistema/usuarios/perfis', label: 'Perfis de acesso', active: false, icon: <ShieldCheck aria-hidden="true" /> },
          ]}
        />
      </div>
      <Card>
        <div className="table-wrap">
          <table className="table table--stack">
            <thead>
              <tr>
                <th scope="col">Usuário</th>
                <th scope="col">Perfil</th>
                <th scope="col">Situação</th>
                <th scope="col">Último acesso</th>
                {canManage ? <th scope="col" className="actions" /> : null}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="cell-primary" data-label="">
                    <span className="cluster" style={{ gap: 12, flexWrap: 'nowrap' }}>
                      <span className="avatar avatar--sm" aria-hidden="true">
                        {initials(u.name)}
                      </span>
                      <span>
                        {u.name}
                        <span className="cell-sub mono">{u.username}</span>
                      </span>
                    </span>
                  </td>
                  <td data-label="Perfil">
                    <Badge tone={u.roleKey === 'admin' ? 'violet' : 'blue'}>{u.roleName}</Badge>
                  </td>
                  <td data-label="Situação">
                    {u.isActive ? <Badge tone="green" dot>Ativo</Badge> : <Badge tone="slate" dot>Inativo</Badge>}
                    {u.mustChangePassword ? (
                      <>
                        {' '}
                        <Badge tone="amber">Senha temporária</Badge>
                      </>
                    ) : null}
                  </td>
                  <td data-label="Último acesso" className="text-muted">
                    {u.lastLoginAt ? formatDateTimeBR(u.lastLoginAt, company.timezone) : 'Nunca acessou'}
                  </td>
                  {canManage ? (
                    <td className="actions" data-label="">
                      <Link href={`/sistema/usuarios/${u.id}`} className="btn btn--sm btn--icon" aria-label={`Editar ${u.name}`} title="Editar">
                        <Pencil aria-hidden="true" />
                      </Link>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

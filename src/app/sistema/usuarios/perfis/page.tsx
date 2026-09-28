import Link from 'next/link';
import { Pencil, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import { deleteRoleAction } from '@/actions/users';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ConfirmActionForm } from '@/components/ui/ConfirmActionForm';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { ALL_PERMISSIONS } from '@/config/permissions';
import { requirePagePermission } from '@/server/auth/session';
import { hasPermission } from '@/server/auth/types';
import { listRoles } from '@/server/services/users';

export const metadata = { title: 'Perfis de acesso' };

export default async function RolesPage() {
  const viewer = await requirePagePermission('users.view');
  const roles = await listRoles();
  const canManage = hasPermission(viewer, 'users.manage');

  return (
    <>
      <PageHeader
        title="Perfis de acesso"
        subtitle="Cada perfil define o que os usuários podem ver e fazer. Adicione novos perfis quando a equipe crescer."
        actions={
          canManage ? (
            <Link href="/sistema/usuarios/perfis/novo" className="btn btn--primary">
              <Plus aria-hidden="true" /> Novo perfil
            </Link>
          ) : null
        }
      />
      <div style={{ marginBottom: 20 }}>
        <Tabs
          label="Seções de usuários"
          items={[
            { href: '/sistema/usuarios', label: 'Usuários', active: false, icon: <Users aria-hidden="true" /> },
            { href: '/sistema/usuarios/perfis', label: 'Perfis de acesso', active: true, icon: <ShieldCheck aria-hidden="true" /> },
          ]}
        />
      </div>
      <Card>
        <div className="table-wrap">
          <table className="table table--stack">
            <thead>
              <tr>
                <th scope="col">Perfil</th>
                <th scope="col">Permissões</th>
                <th scope="col" className="num">
                  Usuários
                </th>
                {canManage ? <th scope="col" className="actions" /> : null}
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.id}>
                  <td className="cell-primary" data-label="">
                    {r.name} {r.isSystem ? <Badge tone="slate">Do sistema</Badge> : null}
                    {r.description ? <span className="cell-sub">{r.description}</span> : null}
                  </td>
                  <td data-label="Permissões">{r.key === 'admin' ? 'Todas' : `${r.permissions.length} de ${ALL_PERMISSIONS.length}`}</td>
                  <td className="num" data-label="Usuários">
                    {r.userCount}
                  </td>
                  {canManage ? (
                    <td className="actions" data-label="">
                      <span className="cluster" style={{ gap: 6, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                        <Link href={`/sistema/usuarios/perfis/${r.id}`} className="btn btn--sm btn--icon" aria-label={`Editar ${r.name}`} title="Editar">
                          <Pencil aria-hidden="true" />
                        </Link>
                        {!r.isSystem ? (
                          <ConfirmActionForm
                            action={deleteRoleAction}
                            fields={{ id: r.id }}
                            title="Excluir perfil?"
                            message={`O perfil “${r.name}” será removido. Só é possível excluir perfis sem usuários.`}
                            confirmLabel="Excluir"
                            triggerLabel={`Excluir ${r.name}`}
                            triggerIcon={<Trash2 aria-hidden="true" />}
                            iconOnly
                          />
                        ) : null}
                      </span>
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

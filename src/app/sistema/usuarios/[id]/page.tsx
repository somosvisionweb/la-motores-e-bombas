import { notFound } from 'next/navigation';
import { ResetPasswordDialog, UserForm } from '@/components/system/users/UserForms';
import { Card, CardBody } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { requirePagePermission } from '@/server/auth/session';
import { getUser, listRoles } from '@/server/services/users';

export const metadata = { title: 'Editar usuário' };

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission('users.manage');
  const { id } = await params;
  const user = Number.isInteger(Number(id)) ? await getUser(Number(id)) : null;
  if (!user) notFound();
  const roles = await listRoles();

  return (
    <div className="page--narrow" style={{ marginInline: 'auto' }}>
      <PageHeader
        title={user.name}
        crumbs={[{ label: 'Usuários', href: '/sistema/usuarios' }, { label: user.name }]}
        subtitle={<span className="mono">{user.username}</span>}
        actions={<ResetPasswordDialog userId={user.id} username={user.username} name={user.name} />}
      />
      <Card>
        <CardBody>
          <UserForm
            roles={roles.map((r) => ({ id: r.id, name: r.name }))}
            user={{ id: user.id, name: user.name, username: user.username, email: user.email, roleId: user.roleId, isActive: user.isActive }}
          />
        </CardBody>
      </Card>
    </div>
  );
}

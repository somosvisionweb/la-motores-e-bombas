import { notFound } from 'next/navigation';
import { saveRoleAction } from '@/actions/users';
import { RoleForm } from '@/components/system/users/UserForms';
import { Card, CardBody } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { requirePagePermission } from '@/server/auth/session';
import { getRole } from '@/server/services/users';

export const metadata = { title: 'Editar perfil' };

export default async function EditRolePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission('users.manage');
  const { id } = await params;
  const role = Number.isInteger(Number(id)) ? await getRole(Number(id)) : null;
  if (!role) notFound();

  return (
    <div className="page--narrow" style={{ marginInline: 'auto' }}>
      <PageHeader title={role.name} crumbs={[{ label: 'Usuários', href: '/sistema/usuarios' }, { label: 'Perfis', href: '/sistema/usuarios/perfis' }, { label: role.name }]} />
      <Card>
        <CardBody>
          <RoleForm action={saveRoleAction} role={{ id: role.id, key: role.key, name: role.name, description: role.description, permissions: role.permissions, isSystem: role.isSystem }} readOnlyPermissions={role.key === 'admin'} />
        </CardBody>
      </Card>
    </div>
  );
}

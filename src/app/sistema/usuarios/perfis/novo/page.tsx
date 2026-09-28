import { saveRoleAction } from '@/actions/users';
import { RoleForm } from '@/components/system/users/UserForms';
import { Card, CardBody } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { requirePagePermission } from '@/server/auth/session';

export const metadata = { title: 'Novo perfil' };

export default async function NewRolePage() {
  await requirePagePermission('users.manage');
  return (
    <div className="page--narrow" style={{ marginInline: 'auto' }}>
      <PageHeader title="Novo perfil de acesso" crumbs={[{ label: 'Usuários', href: '/sistema/usuarios' }, { label: 'Perfis', href: '/sistema/usuarios/perfis' }, { label: 'Novo' }]} />
      <Card>
        <CardBody>
          <RoleForm action={saveRoleAction} />
        </CardBody>
      </Card>
    </div>
  );
}

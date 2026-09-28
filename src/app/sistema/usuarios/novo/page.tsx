import { UserForm } from '@/components/system/users/UserForms';
import { Card, CardBody } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { requirePagePermission } from '@/server/auth/session';
import { listRoles } from '@/server/services/users';

export const metadata = { title: 'Novo usuário' };

export default async function NewUserPage() {
  await requirePagePermission('users.manage');
  const roles = await listRoles();
  return (
    <div className="page--narrow" style={{ marginInline: 'auto' }}>
      <PageHeader title="Novo usuário" crumbs={[{ label: 'Usuários', href: '/sistema/usuarios' }, { label: 'Novo' }]} subtitle="Uma senha temporária será gerada e exibida uma única vez." />
      <Card>
        <CardBody>
          <UserForm roles={roles.map((r) => ({ id: r.id, name: r.name }))} />
        </CardBody>
      </Card>
    </div>
  );
}

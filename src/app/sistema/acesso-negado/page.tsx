import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { firstAllowedHref } from '@/config/navigation';
import { requireUser } from '@/server/auth/session';

export const metadata = { title: 'Acesso negado' };

export default async function ForbiddenPage() {
  const user = await requireUser();
  return (
    <div className="card" style={{ marginTop: 24 }}>
      <EmptyState
        icon={<ShieldAlert size={26} aria-hidden="true" />}
        title="Você não tem acesso a esta área"
        action={
          <Link href={firstAllowedHref(user.permissions)} className="btn btn--brand">
            Voltar ao início
          </Link>
        }
      >
        O seu perfil de acesso não inclui esta página. Se precisar dela, peça ao administrador para ajustar as permissões.
      </EmptyState>
    </div>
  );
}

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { MotorBlueprint } from '@/components/ui/Blueprints';
import { BrandMark } from './BrandMark';

/** Layout das telas de acesso (login e troca de senha): painel da marca + cartão do formulário. */
export function AuthLayoutShell({
  company,
  title,
  subtitle,
  children,
  showBackLink = true,
}: {
  company: { name: string; logoFileId: number | null };
  title: string;
  subtitle: string;
  children: React.ReactNode;
  showBackLink?: boolean;
}) {
  return (
    <div className="auth">
      <aside className="auth__brand" aria-hidden="false">
        <BrandMark name={company.name} logoFileId={company.logoFileId} surface="dark" fontSize={22} logoHeight={44} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 className="auth__brand-title">
            Controle completo dos seus <span>atendimentos.</span>
          </h2>
          <p className="auth__brand-text">
            Clientes, ordens de serviço, estoque, financeiro e documentos em um só lugar — feito para a rotina da assistência técnica.
          </p>
        </div>
        <MotorBlueprint className="auth__art" labels={false} title="" />
      </aside>
      <main className="auth__panel" id="conteudo">
        <div className="auth__card">
          <div className="auth__mobile-brand">
            <BrandMark name={company.name} logoFileId={company.logoFileId} surface="light" fontSize={19} logoHeight={40} />
          </div>
          <h1 className="auth__title">{title}</h1>
          <p className="auth__subtitle">{subtitle}</p>
          {children}
          {showBackLink ? (
            <p style={{ marginTop: 28 }}>
              <Link href="/" className="cluster" style={{ gap: 6, fontSize: 14 }}>
                <ArrowLeft size={16} aria-hidden="true" /> Voltar ao site
              </Link>
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import '@/styles/app.css';
import '@/styles/charts.css';
import { Alert } from '@/components/ui/Alert';
import { FlashToaster, ToastProvider } from '@/components/ui/Toast';
import { BrandMark } from '@/components/system/BrandMark';
import { GlobalSearch } from '@/components/system/GlobalSearch';
import { NotificationBell } from '@/components/system/NotificationBell';
import { ShellProvider, Sidebar, SidebarToggle } from '@/components/system/Shell';
import { UserMenu } from '@/components/system/UserMenu';
import { visibleNav } from '@/config/navigation';
import { initials } from '@/lib/text';
import { requireUser } from '@/server/auth/session';
import { hasPermission } from '@/server/auth/types';
import { hasDemoData } from '@/server/services/demo';
import { getCompanySettings } from '@/server/services/settings';
import { countNewStoreOrders } from '@/server/services/store-orders';

export const metadata: Metadata = {
  title: { default: 'Sistema', template: '%s | LA Motores e Bombas' },
  robots: { index: false, follow: false },
};

export default async function SystemLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const canSeeStore = hasPermission(user, 'store.view');
  const [company, demo, newStoreOrders] = await Promise.all([getCompanySettings(), hasDemoData(), canSeeStore ? countNewStoreOrders() : Promise.resolve(0)]);
  const groups = visibleNav(user.permissions);

  return (
    <ToastProvider>
      <FlashToaster />
      <ShellProvider>
        <div className="app">
          <a href="#conteudo" className="skip-link">
            Ir para o conteúdo
          </a>
          <Sidebar
            groups={groups.map((g) => ({
              label: g.label,
              items: g.items.map(({ href, label, icon, exact }) => ({ href, label, icon, exact, badge: href === '/sistema/loja' ? newStoreOrders : undefined })),
            }))}
            brand={<BrandMark name={company.name} logoFileId={company.logoFileId} surface="dark" fontSize={17} logoHeight={32} />}
            footer={
              <div className="sidebar__user">
                <span className="avatar avatar--sm" aria-hidden="true">
                  {initials(user.name)}
                </span>
                <div style={{ minWidth: 0 }}>
                  <p className="sidebar__user-name">{user.name}</p>
                  <p className="sidebar__user-role">{user.roleName}</p>
                </div>
              </div>
            }
          />
          <div className="app__main">
            <header className="topbar">
              <SidebarToggle />
              <GlobalSearch />
              <div className="topbar__spacer" />
              <NotificationBell />
              <UserMenu name={user.name} roleName={user.roleName} />
            </header>
            <main id="conteudo" className="page">
              {demo ? (
                <Alert variant="demo" title="Dados de DEMONSTRAÇÃO no sistema" className="demo-banner">
                  Existem clientes, ordens, pedidos da loja, pagamentos e custos fictícios — e preços de demonstração na loja virtual —, criados
                  apenas para conhecer o sistema (identificados com o selo “Demonstração”).{' '}
                  {hasPermission(user, 'settings.manage') ? (
                    <Link href="/sistema/configuracoes/dados">Remover os dados de demonstração</Link>
                  ) : (
                    'Peça ao administrador para removê-los antes do uso real.'
                  )}
                </Alert>
              ) : null}
              {children}
            </main>
          </div>
        </div>
      </ShellProvider>
    </ToastProvider>
  );
}

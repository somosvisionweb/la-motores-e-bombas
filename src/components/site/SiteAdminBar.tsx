import Link from 'next/link';
import { LayoutDashboard, Package, Plus, ShoppingBag } from 'lucide-react';
import { hasPermission, type SessionUser } from '@/server/auth/types';

/** O usuário logado tem algum motivo para ver a barra de administração no site público? */
export function canSeeSiteAdminBar(user: SessionUser | null): user is SessionUser {
  return Boolean(user && !user.mustChangePassword && (hasPermission(user, 'store.view') || hasPermission(user, 'products.view') || hasPermission(user, 'dashboard.view')));
}

/**
 * Faixa exibida SÓ para a equipe logada quando ela navega pelo site público: atalhos para gerenciar a loja
 * (pedidos, produtos, adicionar item). Visitantes comuns nunca veem.
 */
export function SiteAdminBar({ user, newOrders }: { user: SessionUser; newOrders: number }) {
  return (
    <div className="site-adminbar" role="region" aria-label="Atalhos da administração">
      <div className="site-container site-adminbar__inner">
        <span className="site-adminbar__who">
          Administração · <strong>{user.name}</strong>
        </span>
        <nav aria-label="Atalhos do sistema">
          {hasPermission(user, 'dashboard.view') ? (
            <Link href="/sistema">
              <LayoutDashboard aria-hidden="true" /> Painel
            </Link>
          ) : null}
          {hasPermission(user, 'store.view') ? (
            <Link href="/sistema/loja">
              <ShoppingBag aria-hidden="true" /> Pedidos{newOrders > 0 ? <span className="site-adminbar__badge">{newOrders}</span> : null}
            </Link>
          ) : null}
          {hasPermission(user, 'products.view') ? (
            <Link href="/sistema/loja/produtos">
              <Package aria-hidden="true" /> Produtos da loja
            </Link>
          ) : null}
          {hasPermission(user, 'products.manage') ? (
            <Link href="/sistema/loja/produtos#adicionar" className="site-adminbar__primary">
              <Plus aria-hidden="true" /> Adicionar item
            </Link>
          ) : null}
        </nav>
      </div>
    </div>
  );
}

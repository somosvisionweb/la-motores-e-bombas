import type { PermissionKey } from './permissions';

export type NavIconName =
  | 'dashboard'
  | 'customers'
  | 'orders'
  | 'services'
  | 'products'
  | 'sales'
  | 'store'
  | 'finance'
  | 'reports'
  | 'print'
  | 'users'
  | 'settings';

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
  /** O item aparece se o usuário tiver QUALQUER uma destas permissões. */
  anyOf: PermissionKey[];
  exact?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Menu lateral do sistema (ordem definida no briefing). */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operação',
    items: [
      { href: '/sistema', label: 'Dashboard', icon: 'dashboard', anyOf: ['dashboard.view'], exact: true },
      { href: '/sistema/clientes', label: 'Clientes', icon: 'customers', anyOf: ['customers.view'] },
      { href: '/sistema/ordens', label: 'Ordens de Serviço', icon: 'orders', anyOf: ['orders.view'] },
    ],
  },
  {
    label: 'Catálogo',
    items: [
      { href: '/sistema/servicos', label: 'Serviços', icon: 'services', anyOf: ['services.view'] },
      { href: '/sistema/produtos', label: 'Produtos', icon: 'products', anyOf: ['products.view'] },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { href: '/sistema/vendas', label: 'Vendas', icon: 'sales', anyOf: ['sales.view'] },
      { href: '/sistema/loja', label: 'Loja online', icon: 'store', anyOf: ['store.view'] },
      { href: '/sistema/financeiro', label: 'Financeiro', icon: 'finance', anyOf: ['payments.view', 'expenses.view'] },
      { href: '/sistema/relatorios', label: 'Relatórios', icon: 'reports', anyOf: ['reports.view'] },
      { href: '/sistema/impressao', label: 'Impressão', icon: 'print', anyOf: ['documents.print'] },
    ],
  },
  {
    label: 'Administração',
    items: [
      { href: '/sistema/usuarios', label: 'Usuários', icon: 'users', anyOf: ['users.view'] },
      { href: '/sistema/configuracoes', label: 'Configurações', icon: 'settings', anyOf: ['settings.manage'] },
    ],
  },
];

export function visibleNav(permissions: string[]): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.anyOf.some((p) => permissions.includes(p))),
  })).filter((group) => group.items.length > 0);
}

/** Primeira página que o usuário pode acessar (destino padrão após o login). */
export function firstAllowedHref(permissions: string[]): string {
  return visibleNav(permissions)[0]?.items[0]?.href ?? '/sistema/conta';
}

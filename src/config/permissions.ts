/**
 * Catálogo de permissões do sistema.
 *
 * Cada perfil (role) guarda uma lista de chaves deste catálogo. Para liberar uma nova
 * ação no futuro basta adicionar a chave aqui, protegê-la no serviço/ação correspondente
 * e marcá-la no perfil desejado em Usuários → Perfis de acesso.
 */
export const PERMISSION_GROUPS = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    permissions: [
      { key: 'dashboard.view', label: 'Ver dashboard operacional' },
      { key: 'finance.view', label: 'Ver valores financeiros (entradas, custos, resultado)' },
    ],
  },
  {
    key: 'customers',
    label: 'Clientes',
    permissions: [
      { key: 'customers.view', label: 'Consultar clientes e histórico' },
      { key: 'customers.create', label: 'Cadastrar clientes' },
      { key: 'customers.edit', label: 'Editar clientes' },
      { key: 'customers.delete', label: 'Excluir clientes' },
    ],
  },
  {
    key: 'orders',
    label: 'Ordens de serviço',
    permissions: [
      { key: 'orders.view', label: 'Consultar ordens de serviço' },
      { key: 'orders.create', label: 'Criar ordens de serviço' },
      { key: 'orders.edit', label: 'Editar ordens de serviço' },
      { key: 'orders.status', label: 'Alterar status da ordem' },
      { key: 'orders.delete', label: 'Excluir ordens de serviço' },
    ],
  },
  {
    key: 'catalog',
    label: 'Serviços e produtos',
    permissions: [
      { key: 'services.view', label: 'Consultar serviços' },
      { key: 'services.manage', label: 'Cadastrar, editar e excluir serviços' },
      { key: 'products.view', label: 'Consultar produtos e estoque' },
      { key: 'products.manage', label: 'Cadastrar, editar e excluir produtos' },
      { key: 'products.stock', label: 'Ajustar estoque manualmente' },
    ],
  },
  {
    key: 'sales',
    label: 'Vendas',
    permissions: [
      { key: 'sales.view', label: 'Consultar vendas' },
      { key: 'sales.create', label: 'Cadastrar vendas' },
      { key: 'sales.cancel', label: 'Cancelar vendas' },
    ],
  },
  {
    key: 'store',
    label: 'Loja virtual',
    permissions: [
      { key: 'store.view', label: 'Consultar pedidos da loja virtual' },
      { key: 'store.manage', label: 'Atender pedidos da loja (confirmar, separar, entregar, concluir)' },
    ],
  },
  {
    key: 'finance',
    label: 'Financeiro',
    permissions: [
      { key: 'payments.view', label: 'Consultar pagamentos recebidos' },
      { key: 'payments.create', label: 'Registrar pagamentos' },
      { key: 'payments.void', label: 'Estornar pagamentos' },
      { key: 'expenses.view', label: 'Consultar custos' },
      { key: 'expenses.manage', label: 'Cadastrar, editar e excluir custos' },
    ],
  },
  {
    key: 'reports',
    label: 'Relatórios e documentos',
    permissions: [
      { key: 'reports.view', label: 'Ver relatórios' },
      { key: 'reports.export', label: 'Exportar / imprimir relatórios' },
      { key: 'documents.print', label: 'Imprimir OS, recibos e comprovantes' },
    ],
  },
  {
    key: 'admin',
    label: 'Administração',
    permissions: [
      { key: 'users.view', label: 'Consultar usuários' },
      { key: 'users.manage', label: 'Gerenciar usuários e perfis de acesso' },
      { key: 'settings.manage', label: 'Alterar configurações da empresa, termos e site' },
    ],
  },
] as const;

export type PermissionKey = (typeof PERMISSION_GROUPS)[number]['permissions'][number]['key'];

export const ALL_PERMISSIONS: PermissionKey[] = PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => p.key));

export const PERMISSION_LABEL: Record<string, string> = Object.fromEntries(
  PERMISSION_GROUPS.flatMap((g) => g.permissions.map((p) => [p.key, p.label])),
);

export function isPermissionKey(value: unknown): value is PermissionKey {
  return typeof value === 'string' && (ALL_PERMISSIONS as string[]).includes(value);
}

/** Perfis iniciais. O administrador sempre possui todas as permissões. */
export const DEFAULT_ROLES: {
  key: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: PermissionKey[];
}[] = [
  {
    key: 'admin',
    name: 'Administrador',
    description: 'Acesso completo ao sistema, incluindo financeiro, usuários e configurações.',
    isSystem: true,
    permissions: ALL_PERMISSIONS,
  },
  {
    key: 'seller',
    name: 'Vendedor / Atendente',
    description:
      'Atendimento no balcão: clientes, ordens de serviço, vendas, pedidos da loja virtual, pagamentos e impressão de documentos. Sem acesso a configurações sensíveis.',
    isSystem: true,
    permissions: [
      'dashboard.view',
      'customers.view',
      'customers.create',
      'customers.edit',
      'orders.view',
      'orders.create',
      'orders.edit',
      'orders.status',
      'services.view',
      'products.view',
      'sales.view',
      'sales.create',
      'store.view',
      'store.manage',
      'payments.view',
      'payments.create',
      'documents.print',
    ],
  },
];

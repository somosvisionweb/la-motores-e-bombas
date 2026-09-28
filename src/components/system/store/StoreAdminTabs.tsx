import { Tabs } from '@/components/ui/Tabs';

/** Abas da área "Loja online" do sistema: pedidos, produtos da loja e (para administradores) configurações. */
export function StoreAdminTabs({ active, canSeeCatalog, canSeeSettings }: { active: 'pedidos' | 'produtos'; canSeeCatalog: boolean; canSeeSettings: boolean }) {
  const items = [
    { href: '/sistema/loja', label: 'Pedidos', active: active === 'pedidos' },
    ...(canSeeCatalog ? [{ href: '/sistema/loja/produtos', label: 'Produtos da loja', active: active === 'produtos' }] : []),
    ...(canSeeSettings ? [{ href: '/sistema/configuracoes/loja', label: 'Configurações da loja', active: false }] : []),
  ];
  return (
    <div style={{ marginBottom: 20 }}>
      <Tabs label="Áreas da loja online" items={items} />
    </div>
  );
}

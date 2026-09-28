import { Tabs } from '@/components/ui/Tabs';

const TABS = [
  { key: 'empresa', href: '/sistema/configuracoes', label: 'Empresa' },
  { key: 'publicacao', href: '/sistema/configuracoes/publicacao', label: 'Publicação' },
  { key: 'logo', href: '/sistema/configuracoes/logo', label: 'Logo e imagens do site' },
  { key: 'loja', href: '/sistema/configuracoes/loja', label: 'Loja virtual' },
  { key: 'mensagens', href: '/sistema/configuracoes/mensagens', label: 'Mensagens WhatsApp' },
  { key: 'termos', href: '/sistema/configuracoes/termos', label: 'Termos de garantia' },
  { key: 'site', href: '/sistema/configuracoes/site', label: 'SEO do site' },
  { key: 'dados', href: '/sistema/configuracoes/dados', label: 'Dados e segurança' },
] as const;

export type SettingsTab = (typeof TABS)[number]['key'];

export function SettingsTabs({ active }: { active: SettingsTab }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <Tabs label="Seções das configurações" items={TABS.map((t) => ({ href: t.href, label: t.label, active: t.key === active }))} />
    </div>
  );
}

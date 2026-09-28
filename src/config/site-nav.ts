export interface SiteNavItem {
  /** Âncora da seção na página inicial. */
  id: string;
  label: string;
}

/**
 * Endereço de um item do menu. Na página inicial usa a âncora da seção; nas demais páginas volta à página inicial.
 * Com a loja aberta, "Produtos" leva à loja virtual.
 */
export function siteNavHref(item: SiteNavItem, opts: { onHome: boolean; storeEnabled: boolean }): string {
  if (item.id === 'produtos' && opts.storeEnabled) return '/loja';
  return opts.onHome ? `#${item.id}` : `/#${item.id}`;
}

/** Menu do site público (ordem definida pela empresa). */
export const SITE_NAV: SiteNavItem[] = [
  { id: 'inicio', label: 'Início' },
  { id: 'sobre', label: 'Sobre nós' },
  { id: 'servicos', label: 'Serviços' },
  { id: 'produtos', label: 'Produtos' },
  { id: 'diferencial', label: 'Diferencial' },
  { id: 'atendimento', label: 'Atendimento' },
  { id: 'contato', label: 'Contato' },
];

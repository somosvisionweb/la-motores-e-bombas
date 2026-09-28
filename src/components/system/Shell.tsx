'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu as MenuIcon, X } from 'lucide-react';
import type { NavIconName } from '@/config/navigation';
import { NAV_ICONS } from './nav-icons';

const ShellContext = createContext<{ open: boolean; setOpen: (v: boolean) => void }>({ open: false, setOpen: () => {} });

export function ShellProvider({ children }: { children: React.ReactNode }) {
  // O menu (gaveta no celular) guarda em qual rota foi aberto: ao navegar, deixa de valer e fecha sozinho.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const pathname = usePathname();
  const open = openPath === pathname;
  const setOpen = useCallback((value: boolean) => setOpenPath(value ? pathname : null), [pathname]);

  // Esc fecha o drawer
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  return <ShellContext value={{ open, setOpen }}>{children}</ShellContext>;
}

export interface SidebarGroup {
  label: string;
  items: { href: string; label: string; icon: NavIconName; exact?: boolean; badge?: number }[];
}

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({
  groups,
  brand,
  footer,
}: {
  groups: SidebarGroup[];
  brand: React.ReactNode;
  footer: React.ReactNode;
}) {
  const { open, setOpen } = useContext(ShellContext);
  const pathname = usePathname();

  return (
    <>
      <aside className="sidebar" data-open={open} aria-label="Menu principal">
        <div className="sidebar__brand">
          <Link href="/sistema" aria-label="Ir para o dashboard">
            {brand}
          </Link>
          <button type="button" className="btn btn--ghost btn--icon btn--sm sidebar__close" onClick={() => setOpen(false)} aria-label="Fechar menu">
            <X aria-hidden="true" />
          </button>
        </div>
        <nav className="sidebar__nav">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="sidebar__group">{group.label}</p>
              {group.items.map((item) => {
                const Icon = NAV_ICONS[item.icon];
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="sidebar__link"
                    aria-current={isActive(pathname, item.href, item.exact) ? 'page' : undefined}
                  >
                    <Icon aria-hidden="true" />
                    <span>{item.label}</span>
                    {item.badge ? <span className="sidebar__badge">{item.badge}</span> : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar__footer">{footer}</div>
      </aside>
      <div className="sidebar-backdrop" data-open={open} onClick={() => setOpen(false)} aria-hidden="true" />
    </>
  );
}

export function SidebarToggle() {
  const { open, setOpen } = useContext(ShellContext);
  return (
    <button
      type="button"
      className="btn btn--ghost btn--icon topbar__menu"
      onClick={() => setOpen(!open)}
      aria-label="Abrir menu"
      aria-expanded={open}
    >
      <MenuIcon aria-hidden="true" />
    </button>
  );
}

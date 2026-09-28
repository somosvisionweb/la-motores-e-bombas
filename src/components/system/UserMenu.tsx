'use client';

import Link from 'next/link';
import { KeyRound, LogOut, UserRound } from 'lucide-react';
import { logoutAction } from '@/actions/auth';
import { Menu } from '@/components/ui/Menu';
import { initials } from '@/lib/text';

export function UserMenu({ name, roleName }: { name: string; roleName: string }) {
  return (
    <Menu
      label="Menu do usuário"
      triggerVariant="plain"
      triggerClassName="user-menu__trigger"
      trigger={
        <>
          <span className="avatar avatar--sm" aria-hidden="true">
            {initials(name)}
          </span>
          <span className="user-menu__text user-menu__name">
            {name.split(' ')[0]}
            <span className="user-menu__role" style={{ display: 'block' }}>
              {roleName}
            </span>
          </span>
        </>
      }
    >
      <p className="menu__label">{name}</p>
      <Link href="/sistema/conta" className="menu__item" role="menuitem">
        <UserRound aria-hidden="true" /> Minha conta
      </Link>
      <Link href="/sistema/conta#senha" className="menu__item" role="menuitem">
        <KeyRound aria-hidden="true" /> Alterar senha
      </Link>
      <div className="menu__separator" />
      <form action={logoutAction}>
        <button type="submit" className="menu__item menu__item--danger" role="menuitem">
          <LogOut aria-hidden="true" /> Sair do sistema
        </button>
      </form>
    </Menu>
  );
}

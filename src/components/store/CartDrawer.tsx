'use client';

import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { CartView } from './CartView';
import { setCartDrawerOpen, useCart, useCartDrawer } from './cart-store';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/** Gaveta do carrinho (lado direito). Fecha com Esc, clique fora ou ao navegar; prende o foco enquanto aberta. */
export function CartDrawer() {
  const { open, everOpened } = useCartDrawer();
  const { count } = useCart();
  const pathname = usePathname();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Trocar de página fecha a gaveta.
  useEffect(() => {
    setCartDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCartDrawerOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [open]);

  return (
    <>
      <div className="cart-backdrop" data-open={open} onClick={() => setCartDrawerOpen(false)} aria-hidden="true" />
      <aside ref={panelRef} id="cart-drawer" className="cart-drawer" data-open={open} role="dialog" aria-modal="true" aria-label="Carrinho de compras" inert={!open}>
        <header className="cart-drawer__head">
          <h2>
            Seu carrinho <span>({count})</span>
          </h2>
          <button ref={closeRef} type="button" className="btn btn--ghost btn--icon" onClick={() => setCartDrawerOpen(false)} aria-label="Fechar carrinho">
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="cart-drawer__body">{everOpened ? <CartView variant="drawer" onNavigate={() => setCartDrawerOpen(false)} /> : null}</div>
      </aside>
    </>
  );
}

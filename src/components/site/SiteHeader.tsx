'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CartButton } from '@/components/store/CartButton';
import { BrandMark } from '@/components/system/BrandMark';
import { WhatsAppIcon } from '@/components/ui/brand-icons';
import { siteNavHref, type SiteNavItem } from '@/config/site-nav';
import { linkProps } from '@/lib/site-links';

interface Props {
  name: string;
  logoFileId: number | null;
  nav: SiteNavItem[];
  whatsappHref: string;
  /** Loja virtual aberta: mostra o carrinho e leva "Produtos" à loja. */
  storeEnabled: boolean;
  /** Há produtos à venda: mostra o carrinho. Sem nenhum, a loja funciona só como catálogo (consulta pelo WhatsApp). */
  cartEnabled: boolean;
}

/** Cabeçalho fixo com menu (drawer no celular), destaque da seção atual e botão do WhatsApp. */
export function SiteHeader({ name, logoFileId, nav, whatsappHref, storeEnabled, cartEnabled }: Props) {
  const pathname = usePathname();
  const onHome = pathname === '/';
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [scrolledSection, setActive] = useState(nav[0]?.id ?? '');
  // Nas páginas da loja, "Produtos" é o item atual; na página inicial vale a seção que está na tela.
  const active = pathname.startsWith('/loja') && storeEnabled ? 'produtos' : scrolledSection;
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Destaca no menu a seção que está na tela.
  useEffect(() => {
    const sections = nav.map((item) => document.getElementById(item.id)).filter((el): el is HTMLElement => Boolean(el));
    if (sections.length === 0 || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, [nav]);

  // Drawer: bloqueia a rolagem da página, fecha com Esc e devolve o foco ao botão que o abriu.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const opener = openerRef.current;
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [open]);

  return (
    <>
      <header className="site-header" data-scrolled={scrolled}>
        <div className="site-container site-header__inner">
          <Link href="/" aria-label={`${name} — página inicial`} className="site-brand">
            <BrandMark name={name} logoFileId={logoFileId} surface="light" fontSize={20} logoHeight={44} />
          </Link>

          <nav className="site-nav" aria-label="Menu principal">
            {nav.map((item) => (
              <a key={item.id} href={siteNavHref(item, { onHome, storeEnabled })} aria-current={active === item.id ? 'true' : undefined}>
                {item.label}
              </a>
            ))}
          </nav>

          {cartEnabled ? <CartButton /> : null}

          <a href={whatsappHref} className="btn btn--primary site-header__cta" {...linkProps(whatsappHref)}>
            <WhatsAppIcon /> Falar pelo WhatsApp
          </a>

          <button
            ref={openerRef}
            type="button"
            className="btn btn--icon site-header__menu"
            aria-label="Abrir menu"
            aria-expanded={open}
            aria-controls="site-drawer"
            onClick={() => setOpen(true)}
          >
            <Menu aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Fora do <header>: o desfoque do cabeçalho criaria um novo contexto para elementos fixos. */}
      <div id="site-drawer" className="site-drawer" data-open={open} role="dialog" aria-modal="true" aria-label="Menu" aria-hidden={!open}>
        <div className="site-drawer__head">
          <BrandMark name={name} logoFileId={logoFileId} surface="dark" fontSize={20} logoHeight={40} />
          <button ref={closeRef} type="button" className="btn btn--icon btn--on-dark" aria-label="Fechar menu" onClick={() => setOpen(false)}>
            <X aria-hidden="true" />
          </button>
        </div>
        {nav.map((item) => (
          <a key={item.id} href={siteNavHref(item, { onHome, storeEnabled })} className="site-drawer__link" onClick={() => setOpen(false)}>
            {item.label}
          </a>
        ))}
        <a href={whatsappHref} className="btn btn--primary btn--lg" onClick={() => setOpen(false)} {...linkProps(whatsappHref)}>
          <WhatsAppIcon /> Falar pelo WhatsApp
        </a>
      </div>
    </>
  );
}

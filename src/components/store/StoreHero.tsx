import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface StoreCrumb {
  label: string;
  href?: string;
}

/** Faixa de título das páginas da loja (migalhas, título e apoio). */
export function StoreHero({
  title,
  lead,
  crumbs,
  children,
}: {
  title: string;
  lead?: React.ReactNode;
  crumbs?: StoreCrumb[];
  children?: React.ReactNode;
}) {
  return (
    <section className="store-hero">
      <div className="site-container">
        {crumbs?.length ? (
          <nav className="store-crumbs" aria-label="Você está em">
            {crumbs.map((crumb, index) => (
              <span key={`${crumb.label}-${index}`}>
                {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span aria-current="page">{crumb.label}</span>}
                {index < crumbs.length - 1 ? <ChevronRight aria-hidden="true" /> : null}
              </span>
            ))}
          </nav>
        ) : null}
        <h1>{title}</h1>
        {lead ? <p className="store-hero__lead">{lead}</p> : null}
        {children}
      </div>
    </section>
  );
}

/** Loja fechada pela empresa (Configurações → Loja virtual): mantém o contato pelo WhatsApp. */
export function StoreClosed({ whatsappHref }: { whatsappHref: string }) {
  return (
    <section className="site-section store-page">
      <div className="site-container">
        <div className="store-closed">
          <h2>A loja virtual está fechada no momento</h2>
          <p>Você ainda pode consultar produtos e valores falando com a gente.</p>
          <a href={whatsappHref} className="btn btn--primary btn--lg" target={whatsappHref.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">
            Falar pelo WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}

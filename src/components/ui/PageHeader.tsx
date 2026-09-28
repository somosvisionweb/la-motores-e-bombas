import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface Crumb {
  label: string;
  href?: string;
}

export function PageHeader({
  title,
  subtitle,
  crumbs,
  actions,
  badges,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  crumbs?: Crumb[];
  actions?: React.ReactNode;
  badges?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div className="page-header__titles">
        {crumbs?.length ? (
          <nav className="breadcrumb" aria-label="Você está em">
            {crumbs.map((crumb, index) => (
              <span key={`${crumb.label}-${index}`} className="cluster" style={{ gap: 6 }}>
                {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span>{crumb.label}</span>}
                {index < crumbs.length - 1 ? <ChevronRight aria-hidden="true" /> : null}
              </span>
            ))}
          </nav>
        ) : null}
        <h1 className="page-header__title">
          {title}
          {badges}
        </h1>
        {subtitle ? <p className="page-header__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </div>
  );
}

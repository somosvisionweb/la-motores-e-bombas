import { cn } from '@/lib/cn';

export function Card({
  className,
  accent,
  children,
  id,
}: {
  className?: string;
  accent?: boolean;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className={cn('card', accent && 'card--accent', className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  actions,
  icon,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <header className="card__header">
      {icon}
      <div className="grow">
        <h2 className="card__title">{title}</h2>
        {subtitle ? <p className="card__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="cluster">{actions}</div> : null}
    </header>
  );
}

export function CardBody({ flush, className, children }: { flush?: boolean; className?: string; children: React.ReactNode }) {
  return <div className={cn('card__body', flush && 'card__body--flush', className)}>{children}</div>;
}

export function CardFooter({ children }: { children: React.ReactNode }) {
  return <footer className="card__footer">{children}</footer>;
}

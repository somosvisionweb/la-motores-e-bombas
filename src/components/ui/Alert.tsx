import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'info' | 'success' | 'warning' | 'danger' | 'demo';

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: OctagonAlert,
  demo: Info,
} as const;

export function Alert({
  variant = 'info',
  title,
  children,
  className,
  actions,
}: {
  variant?: Variant;
  title?: string;
  children?: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}) {
  const Icon = ICONS[variant];
  return (
    <div className={cn('alert', variant !== 'info' && `alert--${variant}`, className)} role={variant === 'danger' ? 'alert' : 'status'}>
      <Icon aria-hidden="true" />
      <div className="grow">
        {title ? <p className="alert__title">{title}</p> : null}
        {children ? <div>{children}</div> : null}
      </div>
      {actions ? <div className="cluster">{actions}</div> : null}
    </div>
  );
}

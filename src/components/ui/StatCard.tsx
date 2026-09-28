import { cn } from '@/lib/cn';

export function StatCard({
  label,
  value,
  meta,
  icon,
  accent = 'navy',
  valueTone,
}: {
  label: string;
  value: React.ReactNode;
  meta?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: 'green' | 'navy' | 'red';
  valueTone?: 'positive' | 'negative';
}) {
  return (
    <div className={cn('stat', `stat--${accent}`)}>
      <div className="stat__top">
        <span className="stat__label">{label}</span>
        {icon ? <span className="stat__icon">{icon}</span> : null}
      </div>
      <div className={cn('stat__value', valueTone && `stat__value--${valueTone}`)}>{value}</div>
      {meta ? <div className="stat__meta">{meta}</div> : null}
    </div>
  );
}

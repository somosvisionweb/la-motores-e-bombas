import Link from 'next/link';
import { CalendarRange } from 'lucide-react';
import { PERIOD_KEYS, PERIOD_LABEL, type Period, type PeriodKey } from '@/lib/dates';
import { buildHref, type SearchParams } from '@/lib/query';
import { cn } from '@/lib/cn';

/**
 * Seletor de período (Hoje, 7 dias, 30 dias, Este mês, Mês anterior, Personalizado).
 * Funciona por URL (`?periodo=7d` ou `?periodo=personalizado&de=…&ate=…`), então é compartilhável e não exige JavaScript.
 */
export function PeriodFilter({
  basePath,
  params,
  period,
  className,
}: {
  basePath: string;
  params: SearchParams;
  period: Period;
  className?: string;
}) {
  const presets = PERIOD_KEYS.filter((k): k is Exclude<PeriodKey, 'personalizado'> => k !== 'personalizado');
  return (
    <div className={cn('period-filter', className)}>
      <nav className="segmented" aria-label="Período">
        {presets.map((key) => (
          <Link
            key={key}
            href={buildHref(basePath, params, { periodo: key, de: null, ate: null, pagina: null })}
            className="segmented__item"
            aria-current={period.key === key ? 'true' : undefined}
            scroll={false}
          >
            {PERIOD_LABEL[key]}
          </Link>
        ))}
      </nav>
      <form method="get" action={basePath} className="period-filter__custom">
        {Object.entries(params).map(([name, value]) =>
          ['periodo', 'de', 'ate', 'pagina'].includes(name) || typeof value !== 'string' || !value ? null : <input key={name} type="hidden" name={name} value={value} />,
        )}
        <input type="hidden" name="periodo" value="personalizado" />
        <label className="sr-only" htmlFor="pf-de">
          Data inicial
        </label>
        <input id="pf-de" type="date" name="de" className="input input--sm" defaultValue={period.key === 'personalizado' ? period.from : ''} required />
        <span className="text-muted" aria-hidden="true">
          –
        </span>
        <label className="sr-only" htmlFor="pf-ate">
          Data final
        </label>
        <input id="pf-ate" type="date" name="ate" className="input input--sm" defaultValue={period.key === 'personalizado' ? period.to : ''} required />
        <button type="submit" className={cn('btn btn--sm', period.key === 'personalizado' && 'btn--brand')}>
          <CalendarRange aria-hidden="true" /> Personalizado
        </button>
      </form>
    </div>
  );
}

import { formatPercent, percentOf } from '@/lib/money';

/**
 * Ranking em barras horizontais (uma série = uma cor, sem legenda). O valor fica na ponta da barra.
 * Categorias nominais NÃO variam de cor por valor (comprimento da barra já mostra a magnitude).
 */
export function HBarChart({
  rows,
  formatValue,
  color = 'navy',
  ariaLabel,
  showShare = true,
  emptyText = 'Sem dados neste período.',
  valueHeader = 'Valor',
}: {
  rows: { label: string; value: number; sub?: string }[];
  formatValue: (value: number) => string;
  color?: 'navy' | 'green';
  ariaLabel: string;
  showShare?: boolean;
  emptyText?: string;
  valueHeader?: string;
}) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  const total = rows.reduce((sum, r) => sum + r.value, 0);

  if (rows.length === 0 || max === 0) return <p className="chart__empty chart__empty--inline">{emptyText}</p>;

  return (
    <figure className="hbars" aria-label={ariaLabel}>
      <ul>
        {rows.map((row) => (
          <li key={row.label} className="hbars__row" title={`${row.label}: ${formatValue(row.value)}`}>
            <span className="hbars__label">
              {row.label}
              {row.sub ? <small>{row.sub}</small> : null}
            </span>
            <span className="hbars__track">
              <span className={`hbars__bar chart__bar--${color}`} style={{ width: `${Math.max(1.5, (row.value / max) * 100)}%` }} />
            </span>
            <span className="hbars__value">
              <strong>{formatValue(row.value)}</strong>
              {showShare ? <small>{formatPercent(percentOf(row.value, total))}</small> : null}
            </span>
          </li>
        ))}
      </ul>
      <details className="chart__table">
        <summary>Ver dados em tabela</summary>
        <div className="table-wrap">
          <table className="table table--compact">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col" className="num">
                  {valueHeader}
                </th>
                {showShare ? (
                  <th scope="col" className="num">
                    Participação
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td className="num">{formatValue(row.value)}</td>
                  {showShare ? <td className="num">{formatPercent(percentOf(row.value, total))}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

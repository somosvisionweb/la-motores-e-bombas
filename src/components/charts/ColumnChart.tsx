import { cn } from '@/lib/cn';
import { formatCompactInt, labelStep, niceScale } from './scale';

export interface ChartSeries {
  key: string;
  label: string;
  /** Duas cores validadas (WCAG/CVD): navy-600 e green-600. */
  color: 'navy' | 'green';
  values: number[];
}

/**
 * Gráfico de colunas agrupadas — HTML/CSS puro (sem JavaScript no navegador).
 * Marcas finas (≤ 24px, topo arredondado 4px), vão de 2px entre barras, grade em fio recessivo, legenda quando há 2+ séries,
 * tooltip único por posição (hover e foco de teclado) e tabela equivalente em "Ver dados em tabela".
 */
export function ColumnChart({
  categories,
  fullLabels,
  series,
  formatValue,
  formatAxis,
  ariaLabel,
  height = 220,
  integer = false,
  emptyText = 'Sem movimentação neste período.',
  labelMax = true,
}: {
  categories: string[];
  /** Rótulos completos usados no tooltip e na tabela (ex.: "24/09/2026"). */
  fullLabels?: string[];
  series: ChartSeries[];
  formatValue: (value: number) => string;
  formatAxis?: (value: number) => string;
  ariaLabel: string;
  height?: number;
  integer?: boolean;
  emptyText?: string;
  labelMax?: boolean;
}) {
  const maxValue = Math.max(0, ...series.flatMap((s) => s.values));
  const empty = maxValue === 0;
  const scale = niceScale(maxValue, { integer });
  const axis = formatAxis ?? ((v: number) => formatCompactInt(v));
  const step = labelStep(categories.length);
  // Em gráficos estreitos (celular) só os rótulos "principais" ficam visíveis, para não se sobreporem.
  const narrowStep = step * 2;
  const labels = fullLabels ?? categories;
  const showMaxLabel = labelMax && series.length === 1 && categories.length <= 45 && !empty;
  const maxIndex = showMaxLabel ? series[0]!.values.indexOf(Math.max(...series[0]!.values)) : -1;

  return (
    <figure className="chart" aria-label={ariaLabel}>
      {series.length > 1 ? (
        <ul className="chart__legend" aria-label="Legenda">
          {series.map((s) => (
            <li key={s.key}>
              <span className={`chart__swatch chart__swatch--${s.color}`} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="chart__frame" style={{ ['--chart-h' as string]: `${height}px` }}>
        <div className="chart__plot">
          {scale.ticks.map((tick) => (
            <div key={tick} className="chart__gridline" style={{ bottom: `${(tick / scale.max) * 100}%` }}>
              <span className="chart__ytick">{axis(tick)}</span>
            </div>
          ))}

          {empty ? (
            <p className="chart__empty">{emptyText}</p>
          ) : (
            <div className="chart__cols">
              {categories.map((category, index) => {
                const position = index < categories.length * 0.3 ? 'start' : index > categories.length * 0.7 ? 'end' : 'mid';
                const summary = `${labels[index]}: ${series.map((s) => `${s.label} ${formatValue(s.values[index] ?? 0)}`).join(', ')}`;
                return (
                  <div key={`${category}-${index}`} className={cn('chart__col', `chart__col--${position}`)} tabIndex={0} role="group" aria-label={summary}>
                    <div className="chart__bars">
                      {series.map((s) => {
                        const value = s.values[index] ?? 0;
                        return (
                          <div
                            key={s.key}
                            className={`chart__bar chart__bar--${s.color}`}
                            style={{ height: `${Math.max(value > 0 ? 1.5 : 0, (value / scale.max) * 100)}%` }}
                          />
                        );
                      })}
                    </div>
                    {index === maxIndex ? (
                      <span className="chart__vlabel" style={{ bottom: `calc(${(series[0]!.values[index]! / scale.max) * 100}% + 4px)` }}>
                        {formatValue(series[0]!.values[index]!)}
                      </span>
                    ) : null}
                    <div className="chart__tip" role="tooltip">
                      <strong className="chart__tip-title">{labels[index]}</strong>
                      {series.map((s) => (
                        <div key={s.key} className="chart__tip-row">
                          <span className={`chart__key chart__key--${s.color}`} aria-hidden="true" />
                          <span className="chart__tip-label">{s.label}</span>
                          <strong className="chart__tip-value">{formatValue(s.values[index] ?? 0)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="chart__xaxis" aria-hidden="true">
          {categories.map((category, index) => {
            const major = index % narrowStep === 0;
            const minor = !major && index % step === 0;
            return (
              <span key={`${category}-${index}`} className={cn('chart__xlabel', minor && 'chart__xlabel--minor')}>
                {major || minor ? category : ''}
              </span>
            );
          })}
        </div>
      </div>

      <details className="chart__table">
        <summary>Ver dados em tabela</summary>
        <div className="table-wrap">
          <table className="table table--compact">
            <thead>
              <tr>
                <th scope="col">Período</th>
                {series.map((s) => (
                  <th key={s.key} scope="col" className="num">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labels.map((label, index) => (
                <tr key={`${label}-${index}`}>
                  <td>{label}</td>
                  {series.map((s) => (
                    <td key={s.key} className="num">
                      {formatValue(s.values[index] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

import { ColumnChart } from '@/components/charts/ColumnChart';
import { HBarChart } from '@/components/charts/HBarChart';
import { formatCompactBRL } from '@/components/charts/scale';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { formatBRL, formatInt } from '@/lib/money';
import { formatCell, type ReportChart, type ReportData } from '@/server/services/reports';

function Chart({ chart }: { chart: ReportChart }) {
  if (chart.kind === 'columns') {
    return (
      <ColumnChart
        categories={chart.categories}
        fullLabels={chart.fullLabels}
        series={chart.series}
        formatValue={chart.money ? formatBRL : (v) => formatInt(v)}
        formatAxis={chart.money ? formatCompactBRL : undefined}
        ariaLabel={chart.title}
        integer={!chart.money}
      />
    );
  }
  return (
    <HBarChart
      rows={chart.rows}
      formatValue={chart.money ? formatBRL : (v) => formatInt(v)}
      color={chart.color}
      showShare={chart.showShare}
      ariaLabel={chart.title}
      valueHeader={chart.valueHeader}
    />
  );
}

/** Corpo do relatório na tela: indicadores, gráficos e tabelas (os mesmos números da impressão/PDF/CSV). */
export function ReportView({ data }: { data: ReportData }) {
  return (
    <div className="stack" style={{ ['--gap' as string]: '20px' }}>
      <div className="kpi-grid" style={{ gridTemplateColumns: `repeat(${Math.min(4, Math.max(2, data.kpis.length))}, minmax(0, 1fr))` }}>
        {data.kpis.map((kpi) => (
          <StatCard key={kpi.label} label={kpi.label} value={kpi.value} meta={kpi.hint} valueTone={kpi.tone} accent={kpi.tone === 'negative' ? 'red' : kpi.tone === 'positive' ? 'green' : 'navy'} />
        ))}
      </div>

      {data.charts.length > 0 ? (
        <div className="dash-grid">
          {data.charts.map((chart) => (
            <Card key={chart.title} className={chart.kind === 'columns' && data.charts.length % 2 === 1 ? 'dash-grid__wide' : undefined}>
              <CardHeader title={chart.title} subtitle={chart.subtitle ?? data.period.label} />
              <CardBody>
                <Chart chart={chart} />
              </CardBody>
            </Card>
          ))}
        </div>
      ) : null}

      {data.tables.map((table) => (
        <Card key={table.title}>
          <CardHeader title={table.title} />
          {table.rows.length === 0 ? (
            <CardBody>
              <p className="text-muted">Sem registros neste período.</p>
            </CardBody>
          ) : (
            <div className="table-wrap">
              <table className="table table--stack table--compact">
                <thead>
                  <tr>
                    {table.columns.map((c) => (
                      <th key={c.header} scope="col" className={c.align === 'right' ? 'num' : undefined}>
                        {c.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} data-label={j === 0 ? '' : table.columns[j]!.header} className={[table.columns[j]!.align === 'right' ? 'num' : '', j === 0 ? 'cell-primary' : ''].filter(Boolean).join(' ') || undefined}>
                          {formatCell(table.columns[j]!, cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {table.footer ? (
                  <tfoot>
                    <tr>
                      {table.footer.map((cell, j) => (
                        <td key={j} className={table.columns[j]!.align === 'right' ? 'num' : undefined}>
                          {cell === '' || cell === null ? '' : formatCell(table.columns[j]!, cell)}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          )}
          {table.note ? (
            <CardBody>
              <p className="text-muted" style={{ fontSize: 13 }}>
                {table.note}
              </p>
            </CardBody>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

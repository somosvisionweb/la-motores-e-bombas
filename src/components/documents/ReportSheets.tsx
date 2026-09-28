import type { ReportDocument } from '@/server/documents/report';
import { formatCell, type ReportColumn, type ReportKpi, type ReportTable } from '@/server/services/reports';
import { SheetFooter, SheetHeader } from './Sheet';

const FIRST_PAGE_UNITS = 26;
const NEXT_PAGE_UNITS = 44;

type Block =
  | { type: 'kpis'; kpis: ReportKpi[] }
  | { type: 'table'; title: string; columns: ReportColumn[]; rows: ReportTable['rows']; footer?: ReportTable['footer']; note?: string; continued: boolean };

/** Distribui KPIs e tabelas em folhas A4 (estimando a altura em "linhas") para que cada folha tenha cabeçalho, margens e rodapé. */
function paginate(report: ReportDocument): Block[][] {
  const pages: Block[][] = [[]];
  let used = 0;
  let capacity = FIRST_PAGE_UNITS;
  const newPage = () => {
    pages.push([]);
    used = 0;
    capacity = NEXT_PAGE_UNITS;
  };

  pages[0]!.push({ type: 'kpis', kpis: report.data.kpis });
  used += 4 * Math.ceil(report.data.kpis.length / 4);

  for (const table of report.data.tables) {
    let rows = [...table.rows];
    let continued = false;
    const footerUnits = table.footer ? 1.5 : 0;
    while (true) {
      const headUnits = 3.5;
      let room = capacity - used - headUnits - footerUnits;
      if (room < 3) {
        newPage();
        room = capacity - used - headUnits - footerUnits;
      }
      const take = Math.max(1, Math.floor(room));
      const chunk = rows.slice(0, take);
      rows = rows.slice(take);
      const last = rows.length === 0;
      pages[pages.length - 1]!.push({ type: 'table', title: table.title, columns: table.columns, rows: chunk, footer: last ? table.footer : undefined, note: last ? table.note : undefined, continued });
      used += headUnits + chunk.length + (last ? footerUnits + (table.note ? 1 : 0) : 0);
      if (last) break;
      continued = true;
      newPage();
    }
  }
  return pages;
}

function Table({ block }: { block: Extract<Block, { type: 'table' }> }) {
  return (
    <section className="sheet__section">
      <h2 className="sheet__section-title">
        {block.title}
        {block.continued ? ' (continuação)' : ''}
      </h2>
      <table className="sheet__table">
        <thead>
          <tr>
            {block.columns.map((c) => (
              <th key={c.header} className={c.align === 'right' ? 'num' : undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className={block.columns[j]?.align === 'right' ? 'num' : undefined}>
                  {formatCell(block.columns[j]!, cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {block.footer ? (
          <tfoot>
            <tr>
              {block.footer.map((cell, j) => (
                <td key={j} className={block.columns[j]?.align === 'right' ? 'num' : undefined} style={{ fontWeight: 700, background: '#f1f5fa' }}>
                  {cell === '' || cell === null ? '' : formatCell(block.columns[j]!, cell)}
                </td>
              ))}
            </tr>
          </tfoot>
        ) : null}
      </table>
      {block.note ? <p style={{ marginTop: 4, color: 'var(--ink-muted)', fontSize: '8pt' }}>{block.note}</p> : null}
    </section>
  );
}

export function ReportSheets({ report }: { report: ReportDocument }) {
  const pages = paginate(report);
  return (
    <>
      {pages.map((blocks, pageIndex) => (
        <section className="sheet" key={pageIndex} aria-label={`${report.data.title}, página ${pageIndex + 1}`}>
          <SheetHeader company={report.company} />
          <div className="sheet__title">
            <h1>{report.data.title}</h1>
            <div>
              <strong>Período: {report.periodLabel}</strong>
              <small>Emissão: {report.issuedOn}</small>
            </div>
          </div>
          {blocks.map((block, i) =>
            block.type === 'kpis' ? (
              <div className="report-kpis" key={i}>
                {block.kpis.map((k) => (
                  <div className="report-kpi" key={k.label}>
                    <small>{k.label}</small>
                    <strong>{k.value}</strong>
                    {k.hint ? <small style={{ textTransform: 'none', letterSpacing: 0 }}>{k.hint}</small> : null}
                  </div>
                ))}
              </div>
            ) : (
              <Table key={i} block={block} />
            ),
          )}
          <div className="sheet__spacer" />
          <SheetFooter company={report.company} page={pageIndex + 1} pages={pages.length} />
        </section>
      ))}
    </>
  );
}

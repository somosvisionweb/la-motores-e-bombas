import { notFound } from 'next/navigation';
import { FileDown, FileSpreadsheet, Printer } from 'lucide-react';
import { ReportView } from '@/components/system/reports/ReportView';
import { PageHeader } from '@/components/ui/PageHeader';
import { PeriodFilter } from '@/components/ui/PeriodFilter';
import { Tabs } from '@/components/ui/Tabs';
import { buildHref, firstParam, type SearchParams } from '@/lib/query';
import { buildReportDocument } from '@/server/documents/report';
import { requireReportPage } from '@/server/documents/report-access';
import { hasPermission } from '@/server/auth/types';
import { REPORT_META, REPORT_TYPES } from '@/server/services/reports';

export const metadata = { title: 'Relatório' };

/** "Relatório de serviços" → "Serviços" (rótulo curto da aba). */
function tabLabel(title: string): string {
  const short = title.replace('Relatório de ', '').replace('Relatório ', '');
  return short.charAt(0).toUpperCase() + short.slice(1);
}

export default async function ReportPage({ params, searchParams }: { params: Promise<{ tipo: string }>; searchParams: Promise<SearchParams> }) {
  const { tipo } = await params;
  const query = await searchParams;
  const access = await requireReportPage(tipo, 'view');
  if (!access) notFound();

  const report = await buildReportDocument(access.type, { periodo: firstParam(query.periodo), de: firstParam(query.de), ate: firstParam(query.ate) });
  const { data } = report;
  const canExport = hasPermission(access.user, 'reports.export');
  const qs = buildHref('', { periodo: data.period.key, de: data.period.key === 'personalizado' ? data.period.from : undefined, ate: data.period.key === 'personalizado' ? data.period.to : undefined });
  const basePath = `/sistema/relatorios/${access.type}`;
  const carry = { periodo: data.period.key, ...(data.period.key === 'personalizado' ? { de: data.period.from, ate: data.period.to } : {}) };

  return (
    <>
      <PageHeader
        title={data.title}
        crumbs={[{ label: 'Relatórios', href: '/sistema/relatorios' }, { label: REPORT_META[access.type].title }]}
        subtitle={report.periodLabel}
        actions={
          canExport ? (
            <>
              <a href={`/imprimir/relatorio/${access.type}${qs}`} className="btn">
                <Printer aria-hidden="true" /> Imprimir
              </a>
              <a href={`/api/documentos/relatorio/${access.type}/pdf${qs}&download=1`} className="btn">
                <FileDown aria-hidden="true" /> PDF
              </a>
              <a href={`/api/relatorios/${access.type}/csv${qs}`} className="btn">
                <FileSpreadsheet aria-hidden="true" /> Exportar CSV
              </a>
            </>
          ) : null
        }
      />
      <div style={{ marginBottom: 16 }}>
        <Tabs
          label="Tipos de relatório"
          items={REPORT_TYPES.filter((t) => hasPermission(access.user, REPORT_META[t].permission)).map((t) => ({
            href: buildHref(`/sistema/relatorios/${t}`, carry),
            label: tabLabel(REPORT_META[t].title),
            active: t === access.type,
          }))}
        />
      </div>
      <div className="stack" style={{ ['--gap' as string]: '16px' }}>
        <PeriodFilter basePath={basePath} params={query} period={data.period} />
        <ReportView data={data} />
      </div>
    </>
  );
}

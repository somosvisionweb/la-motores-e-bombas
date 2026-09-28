import { notFound } from 'next/navigation';
import { DocToolbar } from '@/components/documents/DocToolbar';
import { ReportSheets } from '@/components/documents/ReportSheets';
import { buildReportDocument } from '@/server/documents/report';
import { requireReportPage } from '@/server/documents/report-access';
import { toActor } from '@/server/auth/types';
import { recordReport } from '@/server/services/reports';
import { buildHref, firstParam, type SearchParams } from '@/lib/query';

export const metadata = { title: 'Imprimir relatório' };

export default async function PrintReportPage({ params, searchParams }: { params: Promise<{ tipo: string }>; searchParams: Promise<SearchParams> }) {
  const { tipo } = await params;
  const query = await searchParams;
  const access = await requireReportPage(tipo, 'export');
  if (!access) notFound();

  const report = await buildReportDocument(access.type, { periodo: firstParam(query.periodo), de: firstParam(query.de), ate: firstParam(query.ate) });
  await recordReport(report.data, 'PRINT', toActor(access.user));
  const qs = buildHref('', { periodo: report.data.period.key, de: report.data.period.key === 'personalizado' ? report.data.period.from : undefined, ate: report.data.period.key === 'personalizado' ? report.data.period.to : undefined });

  return (
    <>
      <DocToolbar
        title={`${report.data.title} — ${report.periodLabel}`}
        backHref={`/sistema/relatorios/${access.type}${qs}`}
        pdfHref={`/api/documentos/relatorio/${access.type}/pdf${qs ? `${qs}&` : '?'}download=1`}
        autoPrint={firstParam(query.auto) === '1'}
      />
      <ReportSheets report={report} />
    </>
  );
}

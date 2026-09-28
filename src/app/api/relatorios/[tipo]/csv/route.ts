import { buildReportDocument } from '@/server/documents/report';
import { guardReportApi } from '@/server/documents/report-access';
import { toActor } from '@/server/auth/types';
import { recordReport, reportToCsv } from '@/server/services/reports';

/** Exportação em CSV (abre direto no Excel em português: separador ";" e acentos corretos). */
export async function GET(request: Request, context: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await context.params;
  const guard = await guardReportApi(tipo, 'export');
  if ('response' in guard) return guard.response;

  const query = new URL(request.url).searchParams;
  const report = await buildReportDocument(guard.type, { periodo: query.get('periodo') ?? undefined, de: query.get('de') ?? undefined, ate: query.get('ate') ?? undefined });
  await recordReport(report.data, 'CSV', toActor(guard.user));
  const filename = `relatorio-${guard.type}-${report.data.period.from}_${report.data.period.to}.csv`;
  return new Response(reportToCsv(report.data), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

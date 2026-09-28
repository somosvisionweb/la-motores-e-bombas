import { loadLogo } from '@/server/documents/model';
import { pdfResponse } from '@/server/documents/http';
import { renderReportPdf } from '@/server/documents/pdf/documents';
import { buildReportDocument } from '@/server/documents/report';
import { guardReportApi } from '@/server/documents/report-access';
import { toActor } from '@/server/auth/types';
import { recordReport } from '@/server/services/reports';

export async function GET(request: Request, context: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await context.params;
  const guard = await guardReportApi(tipo, 'export');
  if ('response' in guard) return guard.response;

  const query = new URL(request.url).searchParams;
  const report = await buildReportDocument(guard.type, { periodo: query.get('periodo') ?? undefined, de: query.get('de') ?? undefined, ate: query.get('ate') ?? undefined });
  const pdf = await renderReportPdf(report, await loadLogo(report.company));
  await recordReport(report.data, 'PDF', toActor(guard.user));
  return pdfResponse(pdf, `relatorio-${guard.type}-${report.data.period.from}_${report.data.period.to}.pdf`, query.get('download') === '1');
}

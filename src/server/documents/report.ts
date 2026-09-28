import { dateOnlyInTimezone, formatDateBR, resolvePeriod, todayISO } from '@/lib/dates';
import { getCompanySettings } from '../services/settings';
import { buildReport, type ReportData, type ReportType } from '../services/reports';
import { toDocumentCompany, type DocumentCompany } from './model';

export interface ReportDocument {
  data: ReportData;
  company: DocumentCompany;
  issuedOn: string;
  periodLabel: string;
}

/** Interpreta ?periodo=…&de=…&ate=… e monta o relatório com os dados da empresa (para tela, impressão, PDF e CSV). */
export async function buildReportDocument(type: ReportType, query: { periodo?: string; de?: string; ate?: string }): Promise<ReportDocument> {
  const settings = await getCompanySettings();
  const today = todayISO(settings.timezone);
  const period = resolvePeriod(query.periodo || '30d', today, { from: query.de, to: query.ate });
  const data = await buildReport(type, period, { today, timezone: settings.timezone });
  return {
    data,
    company: toDocumentCompany(settings),
    issuedOn: formatDateBR(dateOnlyInTimezone(new Date(), settings.timezone)),
    periodLabel: period.from === period.to ? formatDateBR(period.from) : `${formatDateBR(period.from)} a ${formatDateBR(period.to)}`,
  };
}

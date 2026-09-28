import Link from 'next/link';
import { BarChart3, ClipboardList, FileBarChart, Receipt, Users, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatDateBR, formatDateTimeBR } from '@/lib/dates';
import { requirePagePermission } from '@/server/auth/session';
import { hasPermission } from '@/server/auth/types';
import { listRecentReports, REPORT_META, REPORT_TYPES, type ReportType } from '@/server/services/reports';
import { getCompanySettings } from '@/server/services/settings';

export const metadata = { title: 'Relatórios' };

const ICONS: Record<ReportType, React.ReactNode> = {
  entradas: <Wallet aria-hidden="true" />,
  custos: <Receipt aria-hidden="true" />,
  servicos: <ClipboardList aria-hidden="true" />,
  clientes: <Users aria-hidden="true" />,
  financeiro: <BarChart3 aria-hidden="true" />,
};

const FORMAT_LABEL = { PRINT: 'Impresso', PDF: 'PDF', CSV: 'CSV', VIEW: 'Visualizado' } as const;

export default async function ReportsIndexPage() {
  const user = await requirePagePermission('reports.view');
  const company = await getCompanySettings();
  const available = REPORT_TYPES.filter((type) => hasPermission(user, REPORT_META[type].permission));
  const recent = hasPermission(user, 'reports.export') ? await listRecentReports(8) : [];

  return (
    <>
      <PageHeader title="Relatórios" subtitle="Consulte, imprima, gere em PDF ou exporte para o Excel (CSV)." />
      <div className="grid grid--3">
        {available.map((type) => (
          <Link key={type} href={`/sistema/relatorios/${type}`} className="report-card">
            <span className="report-card__icon">{ICONS[type]}</span>
            <strong>{REPORT_META[type].title}</strong>
            <span className="text-muted">{REPORT_META[type].description}</span>
          </Link>
        ))}
      </div>

      {recent.length > 0 ? (
        <Card className="mt-6">
          <CardHeader title="Gerados recentemente" subtitle="Relatórios impressos, em PDF ou exportados." icon={<FileBarChart size={20} color="var(--navy-500)" aria-hidden="true" />} />
          <CardBody flush>
            <ul>
              {recent.map((r) => (
                <li key={r.id} className="cluster" style={{ padding: '12px 20px', borderBottom: '1px solid var(--gray-150)', justifyContent: 'space-between' }}>
                  <span>
                    <strong>{r.title}</strong>
                    <span className="text-muted" style={{ display: 'block', fontSize: 13 }}>
                      {formatDateBR(r.periodStart)} a {formatDateBR(r.periodEnd)}
                    </span>
                  </span>
                  <span className="cluster">
                    <Badge tone="slate">{FORMAT_LABEL[r.format]}</Badge>
                    <span className="text-muted" style={{ fontSize: 13 }}>
                      {formatDateTimeBR(r.createdAt, company.timezone)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}

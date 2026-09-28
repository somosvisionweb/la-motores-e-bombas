import { DatabaseBackup, ScrollText } from 'lucide-react';
import { DemoDataPanel } from '@/components/system/settings/DemoDataPanel';
import { SettingsTabs } from '@/components/system/settings/SettingsTabs';
import { Alert } from '@/components/ui/Alert';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatDateTimeBR } from '@/lib/dates';
import { requirePagePermission } from '@/server/auth/session';
import { getDatabaseUrl } from '@/server/db/client';
import { listAuditLogs } from '@/server/services/audit';
import { countDemoData } from '@/server/services/demo';
import { getCompanySettings } from '@/server/services/settings';

export const metadata = { title: 'Dados e segurança' };

export default async function DataSettingsPage() {
  await requirePagePermission('settings.manage');
  const [company, demo, logs] = await Promise.all([getCompanySettings(), countDemoData(), listAuditLogs({ limit: 40 })]);
  const hasDemo = demo.customers + demo.orders + demo.sales + demo.payments + demo.expenses > 0;
  const isLocalFile = getDatabaseUrl().startsWith('file:');

  return (
    <>
      <PageHeader title="Dados e segurança" subtitle="Dados de demonstração, cópia de segurança e histórico de operações." />
      <SettingsTabs active="dados" />
      <div className="stack" style={{ ['--gap' as string]: '20px' }}>
        <Card>
          <CardHeader title="Dados de demonstração" subtitle="Registros fictícios (clientes, ordens, vendas, pagamentos e custos) para conhecer o sistema." />
          <CardBody>
            <div className="stack" style={{ ['--gap' as string]: '14px' }}>
              {hasDemo ? (
                <Alert variant="demo" title="Há dados de demonstração no sistema">
                  {demo.customers} clientes · {demo.orders} ordens · {demo.sales} vendas · {demo.payments} pagamentos · {demo.expenses} custos. Eles aparecem com o selo “Demonstração” e{' '}
                  <strong>nunca alteram o estoque real</strong>. Remova-os antes de começar a usar o sistema de verdade.
                </Alert>
              ) : (
                <p className="text-muted">Nenhum dado de demonstração no sistema.</p>
              )}
              <DemoDataPanel hasDemo={hasDemo} />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Cópia de segurança (backup)" icon={<DatabaseBackup size={20} color="var(--navy-500)" aria-hidden="true" />} />
          <CardBody>
            {isLocalFile ? (
              <div className="stack" style={{ ['--gap' as string]: '12px' }}>
                <p>Baixe uma cópia completa do banco de dados (clientes, ordens, financeiro, configurações, logo e imagens). Guarde em local seguro — recomenda-se fazer semanalmente.</p>
                <div>
                  <a href="/api/backup" className="btn btn--brand">
                    <DatabaseBackup aria-hidden="true" /> Baixar backup agora
                  </a>
                </div>
              </div>
            ) : (
              <p>O banco está na nuvem (Turso): use os backups e o ponto de restauração do próprio provedor.</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Histórico de operações" subtitle="Últimas ações registradas (quem fez o quê e quando)." icon={<ScrollText size={20} color="var(--navy-500)" aria-hidden="true" />} />
          <div className="table-wrap">
            <table className="table table--stack table--compact">
              <thead>
                <tr>
                  <th scope="col">Quando</th>
                  <th scope="col">Usuário</th>
                  <th scope="col">Ação</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td data-label="Quando" className="nowrap text-muted">
                      {formatDateTimeBR(log.createdAt, company.timezone)}
                    </td>
                    <td data-label="Usuário">{log.userName ?? '—'}</td>
                    <td data-label="Ação">{log.summary ?? log.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}

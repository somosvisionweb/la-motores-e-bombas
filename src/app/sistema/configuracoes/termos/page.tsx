import { TermsEditor } from '@/components/system/settings/TermsEditor';
import { SettingsTabs } from '@/components/system/settings/SettingsTabs';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatDateTimeBR } from '@/lib/dates';
import { requirePagePermission } from '@/server/auth/session';
import { getActiveGuaranteeTerms, getCompanySettings, listGuaranteeTermsVersions } from '@/server/services/settings';

export const metadata = { title: 'Termos de garantia' };

export default async function TermsSettingsPage() {
  await requirePagePermission('settings.manage');
  const [terms, versions, company] = await Promise.all([getActiveGuaranteeTerms(), listGuaranteeTermsVersions(), getCompanySettings()]);

  return (
    <>
      <PageHeader title="Termos de garantia" subtitle="Texto exibido ao final de cada ordem de serviço (impressão e PDF)." />
      <SettingsTabs active="termos" />
      <div className="stack" style={{ ['--gap' as string]: '20px' }}>
        <Card>
          <CardHeader title={`Versão ${terms.version} (em uso)`} subtitle="Edite o texto e salve para publicar uma nova versão." />
          <CardBody>
            <TermsEditor initial={{ title: terms.title, warrantyMonths: terms.warrantyMonths, content: terms.content }} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Histórico de versões" />
          <div className="table-wrap">
            <table className="table table--stack table--compact">
              <thead>
                <tr>
                  <th scope="col">Versão</th>
                  <th scope="col">Prazo</th>
                  <th scope="col">Publicada em</th>
                  <th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id}>
                    <td className="cell-primary" data-label="">
                      Versão {v.version}
                    </td>
                    <td data-label="Prazo">{v.warrantyMonths} meses</td>
                    <td data-label="Publicada em">{formatDateTimeBR(v.createdAt, company.timezone)}</td>
                    <td data-label="Situação">{v.isActive ? <Badge tone="green" dot>Em uso</Badge> : <Badge tone="slate">Anterior</Badge>}</td>
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

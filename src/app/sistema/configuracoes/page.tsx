import Link from 'next/link';
import { Palette } from 'lucide-react';
import { buildPrivacyTemplate } from '@/content/privacy-template';
import { BusinessHoursForm, CompanyProfileForm, PaymentMethodsForm, PrivacyPolicyForm } from '@/components/system/settings/SettingsForms';
import { SettingsTabs } from '@/components/system/settings/SettingsTabs';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatDateBR, todayISO } from '@/lib/dates';
import { requirePagePermission } from '@/server/auth/session';
import { getCompanySettings } from '@/server/services/settings';

export const metadata = { title: 'Configurações' };

export default async function SettingsPage() {
  await requirePagePermission('settings.manage');
  const company = await getCompanySettings();

  return (
    <>
      <PageHeader
        title="Configurações da empresa"
        subtitle="Estas informações alimentam o site, os documentos, os PDFs e as mensagens. Altere aqui — sem mexer no código."
        actions={
          <Link href="/sistema/design-system" className="btn btn--ghost">
            <Palette aria-hidden="true" /> Guia de estilo
          </Link>
        }
      />
      <SettingsTabs active="empresa" />
      <div className="stack" style={{ ['--gap' as string]: '20px' }}>
        <Card>
          <CardHeader title="Dados da empresa" />
          <CardBody>
            <CompanyProfileForm company={company} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Horário de atendimento" subtitle="Exibido no site (com dias agrupados automaticamente) e nos dados estruturados do Google." />
          <CardBody>
            <BusinessHoursForm hours={company.hours} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Formas de pagamento aceitas" subtitle="Aparecem no site e como opções nos pagamentos do sistema." />
          <CardBody>
            <PaymentMethodsForm accepted={company.paymentMethods} />
          </CardBody>
        </Card>
        <Card id="privacidade">
          <CardHeader
            title="Política de privacidade"
            subtitle="A loja recebe nome, telefone e endereço dos clientes, então a LGPD pede que a empresa explique como usa esses dados. O texto aparece em /privacidade, no rodapé do site e no checkout."
          />
          <CardBody>
            <PrivacyPolicyForm text={company.privacyText ?? ''} template={buildPrivacyTemplate(company, formatDateBR(todayISO(company.timezone)))} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}

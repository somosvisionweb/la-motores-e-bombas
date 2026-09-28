import { WhatsAppTemplatesForm } from '@/components/system/settings/SettingsForms';
import { SettingsTabs } from '@/components/system/settings/SettingsTabs';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { requirePagePermission } from '@/server/auth/session';
import { getCompanySettings } from '@/server/services/settings';

export const metadata = { title: 'Mensagens do WhatsApp' };

export default async function MessagesSettingsPage() {
  await requirePagePermission('settings.manage');
  const company = await getCompanySettings();
  return (
    <>
      <PageHeader title="Mensagens do WhatsApp" subtitle="Textos pré-preenchidos nos botões do site e no envio de ordens/recibos ao cliente." />
      <SettingsTabs active="mensagens" />
      <Card>
        <CardHeader title="Modelos de mensagem" />
        <CardBody>
          <WhatsAppTemplatesForm templates={company.whatsappTemplates} />
        </CardBody>
      </Card>
    </>
  );
}

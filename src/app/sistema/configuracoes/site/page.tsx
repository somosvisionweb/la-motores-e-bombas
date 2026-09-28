import Link from 'next/link';
import { SeoForm } from '@/components/system/settings/SettingsForms';
import { SettingsTabs } from '@/components/system/settings/SettingsTabs';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { requirePagePermission } from '@/server/auth/session';
import { getCompanySettings, getPublicBaseUrl } from '@/server/services/settings';

export const metadata = { title: 'SEO do site' };

export default async function SeoSettingsPage() {
  await requirePagePermission('settings.manage');
  const company = await getCompanySettings();
  const base = getPublicBaseUrl(company);
  return (
    <>
      <PageHeader title="SEO do site" subtitle="Como o site aparece no Google e ao ser compartilhado." />
      <SettingsTabs active="site" />
      <div className="stack" style={{ ['--gap' as string]: '20px' }}>
        <Card>
          <CardHeader title="Título e descrição" />
          <CardBody>
            <SeoForm seoTitle={company.seoTitle ?? ''} seoDescription={company.seoDescription ?? ''} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="O que já está configurado automaticamente" />
          <CardBody>
            <ul className="stack" style={{ ['--gap' as string]: '6px', listStyle: 'disc', paddingLeft: 20 }}>
              <li>
                Dados estruturados (schema.org) com nome, endereço, telefone, horários e Instagram — vindos das configurações da empresa.
              </li>
              <li>
                <Link href="/sitemap.xml">sitemap.xml</Link> e <Link href="/robots.txt">robots.txt</Link> (a área restrita e os documentos ficam fora dos buscadores).
              </li>
              <li>Endereço canônico e imagens sociais: defina o endereço público em Empresa (atual: <strong>{base}</strong>).</li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

import { LogoForm, SiteImageRow, SiteImageUploadForm } from '@/components/system/settings/ImageForms';
import { SettingsTabs } from '@/components/system/settings/SettingsTabs';
import { Alert } from '@/components/ui/Alert';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { requirePagePermission } from '@/server/auth/session';
import { listSiteImages } from '@/server/services/files';
import { getCompanySettings } from '@/server/services/settings';

export const metadata = { title: 'Logo e imagens do site' };

export default async function LogoSettingsPage() {
  await requirePagePermission('settings.manage');
  const [company, images] = await Promise.all([getCompanySettings(), listSiteImages()]);
  const hero = images.filter((i) => i.slot === 'HERO');
  const gallery = images.filter((i) => i.slot === 'GALLERY');

  return (
    <>
      <PageHeader title="Logo e imagens do site" subtitle="A logo oficial aparece no site, no sistema, nas ordens, nos recibos e nos PDFs." />
      <SettingsTabs active="logo" />
      <div className="stack" style={{ ['--gap' as string]: '20px' }}>
        <Card>
          <CardHeader title="Logo da empresa" />
          <CardBody>
            <LogoForm logoFileId={company.logoFileId} companyName={company.name} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Imagem principal do site" subtitle="Foto real da oficina, de um motor ou de uma bomba. Sem imagem, o site usa uma ilustração técnica." />
          <CardBody>
            <div className="stack" style={{ ['--gap' as string]: '20px' }}>
              {hero.map((image) => (
                <SiteImageRow key={image.id} image={image} />
              ))}
              <SiteImageUploadForm slot="HERO" label={hero.length ? 'Substituir imagem principal' : 'Enviar imagem principal'} hint="Formato horizontal (ex.: 1600×1000). JPG, PNG ou WebP até 6 MB." />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Galeria (fotos reais)" subtitle="Aparece na seção “Nossa oficina” do site somente quando houver fotos. Até 12 imagens." />
          <CardBody>
            <div className="stack" style={{ ['--gap' as string]: '20px' }}>
              {gallery.length === 0 ? (
                <Alert variant="info">Nenhuma foto na galeria. Envie fotos reais para exibir a seção no site — o sistema nunca usa fotos de banco de imagens sozinho.</Alert>
              ) : (
                gallery.map((image) => <SiteImageRow key={image.id} image={image} />)
              )}
              <SiteImageUploadForm slot="GALLERY" label="Adicionar foto à galeria" hint="JPG, PNG ou WebP até 6 MB." />
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

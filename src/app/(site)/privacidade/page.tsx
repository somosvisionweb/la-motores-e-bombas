import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PolicyText } from '@/components/site/PolicyText';
import { StoreHero } from '@/components/store/StoreHero';
import { storeMetadata } from '@/lib/store-seo';
import { getSiteData } from '@/server/services/site';

export async function generateMetadata(): Promise<Metadata> {
  const { company } = await getSiteData();
  return storeMetadata({
    title: `Política de privacidade | ${company.name}`,
    description: `Como a ${company.name} trata os dados pessoais informados neste site.`,
    path: '/privacidade',
    siteName: company.name,
  });
}

/** Política de privacidade escrita pela empresa em Configurações → Empresa. Sem texto cadastrado, a página não existe. */
export default async function PrivacyPage() {
  const { company } = await getSiteData();
  const text = company.privacyText?.trim();
  if (!text) notFound();

  return (
    <>
      <StoreHero title="Política de privacidade" crumbs={[{ label: 'Início', href: '/' }, { label: 'Política de privacidade' }]} />
      <section className="site-section">
        <div className="site-container">
          <PolicyText text={text} />
        </div>
      </section>
    </>
  );
}

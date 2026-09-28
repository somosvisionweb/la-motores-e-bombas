import type { Metadata } from 'next';
import { RevealController } from '@/components/site/RevealController';
import { CartDrawer } from '@/components/store/CartDrawer';
import { canSeeSiteAdminBar, SiteAdminBar } from '@/components/site/SiteAdminBar';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { SiteTopbar } from '@/components/site/SiteTopbar';
import { WhatsAppFab } from '@/components/site/WhatsAppFab';
import { ToastProvider } from '@/components/ui/Toast';
import { SITE_NAV } from '@/config/site-nav';
import { buildLocalBusinessJsonLd, DEFAULT_SEO_DESCRIPTION, DEFAULT_SEO_TITLE, SEO_KEYWORDS, serializeJsonLd } from '@/lib/seo';
import { buildSiteLinks } from '@/lib/site-links';
import { isLocalBaseUrl } from '@/server/services/settings';
import { getSessionUser } from '@/server/auth/session';
import { hasPermission } from '@/server/auth/types';
import { getSiteBaseUrl, getSiteData } from '@/server/services/site';
import { getStoreOverview } from '@/server/services/store';
import { countNewStoreOrders } from '@/server/services/store-orders';
import '@/styles/site.css';
import '@/styles/store.css';

// O conteúdo vem do banco (editável no sistema): a página é montada a cada requisição, com cache curto em memória.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { company } = await getSiteData();
  const baseUrl = await getSiteBaseUrl(company);
  const title = company.seoTitle?.trim() || DEFAULT_SEO_TITLE;
  const description = company.seoDescription?.trim() || DEFAULT_SEO_DESCRIPTION;
  // Endereço de teste (localhost) não deve ser indexado; ao publicar com o domínio real, passa a ser.
  const indexable = !isLocalBaseUrl(baseUrl);

  return {
    metadataBase: new URL(baseUrl),
    title: { absolute: title },
    description,
    keywords: SEO_KEYWORDS,
    alternates: { canonical: '/' },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      type: 'website',
      locale: 'pt_BR',
      siteName: company.name,
      title,
      description,
      url: '/',
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [site, store, sessionUser] = await Promise.all([getSiteData(), getStoreOverview(), getSessionUser()]);
  // Equipe logada vê atalhos de administração no topo do site (visitantes nunca).
  const staff = canSeeSiteAdminBar(sessionUser) ? sessionUser : null;
  const newOrders = staff && hasPermission(staff, 'store.view') ? await countNewStoreOrders() : 0;
  const { company, products, serviceGroups, heroImage } = site;
  const baseUrl = await getSiteBaseUrl(company);
  const links = buildSiteLinks(company);
  const nav = SITE_NAV.filter((item) => item.id !== 'produtos' || products.length > 0);
  const jsonLd = buildLocalBusinessJsonLd({
    company,
    baseUrl,
    description: company.seoDescription?.trim() || DEFAULT_SEO_DESCRIPTION,
    services: serviceGroups.flatMap((group) => group.services),
    heroFileId: heroImage?.fileId ?? null,
  });

  return (
    <div className="site">
      <ToastProvider>
        <a href="#conteudo" className="skip-link">
          Pular para o conteúdo
        </a>
        {staff ? <SiteAdminBar user={staff} newOrders={newOrders} /> : null}
        <SiteTopbar company={company} mapsHref={links.maps} whatsappHref={links.general} />
        <SiteHeader name={company.name} logoFileId={company.logoFileId} nav={nav} whatsappHref={links.general} storeEnabled={store.enabled} cartEnabled={store.sellable} />
        <main id="conteudo">{children}</main>
        <SiteFooter company={company} nav={nav} links={links} year={new Date().getFullYear()} storeEnabled={store.enabled} privacyEnabled={Boolean(company.privacyText?.trim())} />
        <WhatsAppFab href={links.general} />
        {store.sellable ? <CartDrawer /> : null}
        <RevealController />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      </ToastProvider>
    </div>
  );
}

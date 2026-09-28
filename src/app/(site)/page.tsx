import { About } from '@/components/site/sections/About';
import { Contact } from '@/components/site/sections/Contact';
import { Differential } from '@/components/site/sections/Differential';
import { Gallery } from '@/components/site/sections/Gallery';
import { Hero } from '@/components/site/sections/Hero';
import { HomeService } from '@/components/site/sections/HomeService';
import { Products } from '@/components/site/sections/Products';
import { Services } from '@/components/site/sections/Services';
import { StoreShowcase } from '@/components/site/sections/StoreShowcase';
import { buildSiteLinks } from '@/lib/site-links';
import { getSiteData } from '@/server/services/site';
import { listStoreProducts, storeHasSellableProducts } from '@/server/services/store';

export default async function HomePage() {
  const [site, store, canBuy] = await Promise.all([getSiteData(), listStoreProducts({ limit: 10 }), storeHasSellableProducts()]);
  const links = buildSiteLinks(site.company);

  return (
    <>
      <Hero site={site} links={links} storeEnabled={store.config.enabled && canBuy} />
      <About company={site.company} />
      <Services groups={site.serviceGroups} links={links} />
      {store.config.enabled && store.products.length > 0 ? <StoreShowcase catalog={store} links={links} canBuy={canBuy} /> : <Products products={site.products} links={links} />}
      <Differential />
      <HomeService links={links} />
      <Gallery images={site.gallery} companyName={site.company.name} />
      <Contact company={site.company} links={links} />
    </>
  );
}

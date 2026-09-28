import type { Metadata } from 'next';
import { CheckoutForm } from '@/components/store/CheckoutForm';
import { StoreClosed, StoreHero } from '@/components/store/StoreHero';
import { isPaymentMethod, PAYMENT_METHOD_LABEL } from '@/config/payment-methods';
import { fullAddress } from '@/lib/company';
import { buildSiteLinks } from '@/lib/site-links';
import { storeMetadata } from '@/lib/store-seo';
import { getSiteData } from '@/server/services/site';
import { getStoreSettings } from '@/server/services/store-settings';

export async function generateMetadata(): Promise<Metadata> {
  const { company } = await getSiteData();
  return storeMetadata({ title: 'Finalizar pedido', description: 'Finalize o seu pedido na loja virtual.', path: '/loja/finalizar', siteName: company.name, noindex: true });
}

export default async function CheckoutPage() {
  const [site, config] = await Promise.all([getSiteData(), getStoreSettings()]);
  const { company } = site;
  if (!config.enabled) {
    return (
      <>
        <StoreHero title="Finalizar pedido" />
        <StoreClosed whatsappHref={buildSiteLinks(company).general} />
      </>
    );
  }

  // No balcão a empresa recebe dinheiro, PIX e cartão (boleto não faz sentido para retirada).
  const onSiteMethods = company.paymentMethods.filter(isPaymentMethod).filter((method) => method !== 'BOLETO').map((method) => PAYMENT_METHOD_LABEL[method]);

  return (
    <>
      <StoreHero title="Finalizar pedido" crumbs={[{ label: 'Início', href: '/' }, { label: 'Loja', href: '/loja' }, { label: 'Carrinho', href: '/loja/carrinho' }, { label: 'Finalizar' }]} />
      <section className="site-section store-page">
        <div className="site-container">
          <CheckoutForm
            deliveryEnabled={config.deliveryEnabled}
            deliveryFeeCents={config.deliveryFeeCents}
            freeDeliveryMinCents={config.freeDeliveryMinCents}
            deliveryNote={config.deliveryNote}
            pickupNote={config.pickupNote}
            minOrderCents={config.minOrderCents}
            pixAvailable={Boolean(config.pixKey)}
            policyText={config.policyText}
            privacyHref={company.privacyText?.trim() ? '/privacidade' : null}
            onSiteMethods={onSiteMethods}
            pickupAddress={fullAddress(company)}
            startedAt={new Date().getTime()}
          />
        </div>
      </section>
    </>
  );
}

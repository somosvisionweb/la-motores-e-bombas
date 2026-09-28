import Link from 'next/link';
import { CircleCheck, ShoppingCart } from 'lucide-react';
import { MotorBlueprint, PumpBlueprint } from '@/components/ui/Blueprints';
import { WhatsAppIcon } from '@/components/ui/brand-icons';
import { PAYMENT_METHOD_LABEL, isPaymentMethod } from '@/config/payment-methods';
import { SITE_COPY } from '@/content/site';
import { cityLine, groupBusinessHours } from '@/lib/company';
import { linkProps, type SiteCompany, type SiteLinks } from '@/lib/site-links';
import type { SiteData } from '@/server/services/site';

/** Pontos de confiança: somente fatos cadastrados (atendimento, pagamentos, horário). */
function trustPoints(company: SiteCompany & { paymentMethods: string[] }): string[] {
  const points = ['Atendimento a domicílio', 'Manutenção, conserto e rebobinamento'];
  const payments = company.paymentMethods.filter(isPaymentMethod).map((key) => PAYMENT_METHOD_LABEL[key]);
  if (payments.length > 0) points.push(`Pagamento: ${payments.join(', ')}`);
  const open = groupBusinessHours(company.hours).filter((g) => !g.closed);
  if (open.length > 0) points.push(open.map((g) => `${g.label}, ${g.value}`).join(' · '));
  return points;
}

export function Hero({ site, links, storeEnabled = false }: { site: SiteData; links: SiteLinks; storeEnabled?: boolean }) {
  const { company, heroImage } = site;
  const headline = SITE_COPY.heroHeadline;
  const accentAt = headline.indexOf(SITE_COPY.heroAccent);
  const lead = accentAt > 0 ? headline.slice(0, accentAt) : headline;
  const accent = accentAt > 0 ? SITE_COPY.heroAccent : '';
  const city = cityLine(company);

  return (
    <section id="inicio" className="site-hero" aria-labelledby="hero-title">
      <div className="site-container site-hero__inner">
        <div>
          <p className="site-eyebrow site-eyebrow--light">Assistência técnica{city ? ` · ${city}` : ''}</p>
          <h1 id="hero-title">
            {lead}
            {accent ? <em>{accent}</em> : null}
          </h1>
          <p className="site-hero__sub">{SITE_COPY.heroSubheadline}</p>
          <div className="site-hero__actions">
            <a href={links.attendance} className="btn btn--primary btn--lg" {...linkProps(links.attendance)}>
              Solicitar atendimento
            </a>
            <a href={links.general} className="btn btn--on-dark btn--lg" {...linkProps(links.general)}>
              <WhatsAppIcon /> Falar no WhatsApp
            </a>
            {storeEnabled ? (
              <Link href="/loja" className="btn btn--on-dark btn--lg">
                <ShoppingCart aria-hidden="true" /> Comprar peças online
              </Link>
            ) : null}
          </div>
          <ul className="site-hero__trust">
            {trustPoints(company).map((point) => (
              <li key={point}>
                <CircleCheck aria-hidden="true" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="site-hero__art">
          {heroImage ? (
            <div className="site-hero__photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/media/${heroImage.fileId}`}
                alt={heroImage.alt || `${company.name}: assistência técnica em motores elétricos e bombas`}
                width={heroImage.width ?? undefined}
                height={heroImage.height ?? undefined}
                fetchPriority="high"
              />
            </div>
          ) : (
            <>
              <div className="blueprint-card">
                <MotorBlueprint />
                <div className="blueprint-card__title">
                  <span>Motor elétrico</span>
                  <span>Corte frontal</span>
                </div>
              </div>
              <div className="blueprint-card blueprint-card--small" aria-hidden="true">
                <PumpBlueprint labels={false} />
                <div className="blueprint-card__title">
                  <span>Bomba centrífuga</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

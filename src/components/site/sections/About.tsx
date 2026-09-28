import { BadgeCheck, ClipboardCheck, Truck } from 'lucide-react';
import { PAYMENT_METHOD_LABEL, isPaymentMethod } from '@/config/payment-methods';
import { SITE_COPY } from '@/content/site';
import { addressLines, groupBusinessHours } from '@/lib/company';
import type { SiteData } from '@/server/services/site';

const ICONS = [ClipboardCheck, BadgeCheck, Truck];

export function About({ company }: { company: SiteData['company'] }) {
  const hours = groupBusinessHours(company.hours);
  const payments = company.paymentMethods.filter(isPaymentMethod).map((key) => PAYMENT_METHOD_LABEL[key]);
  const address = addressLines(company);

  return (
    <section id="sobre" className="site-section" aria-labelledby="sobre-title">
      <div className="site-container site-about">
        <div className="reveal">
          <p className="site-eyebrow">Sobre nós</p>
          <h2 id="sobre-title" className="site-title">
            Assistência técnica em motores elétricos e bombas
          </h2>
          <p className="site-lead">{SITE_COPY.about.intro}</p>
          <p className="site-about__text">{SITE_COPY.about.specialty}</p>
          <ul className="site-about__list">
            {SITE_COPY.aboutPoints.map((point, index) => {
              const Icon = ICONS[index % ICONS.length]!;
              return (
                <li key={point.title}>
                  <Icon aria-hidden="true" />
                  <div>
                    <strong>{point.title}</strong>
                    <span>{point.text}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <aside className="site-fact-card reveal" aria-label="Dados da empresa">
          <h3>Dados da empresa</h3>
          <dl className="site-facts">
            <div>
              <dt>Empresa</dt>
              <dd>{company.name}</dd>
            </div>
            {company.cnpj ? (
              <div>
                <dt>CNPJ</dt>
                <dd>{company.cnpj}</dd>
              </div>
            ) : null}
            {address.length > 0 ? (
              <div>
                <dt>Endereço</dt>
                <dd className="site-lines">
                  {address.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Horário de atendimento</dt>
              <dd className="site-lines">
                {hours.map((group) => (
                  <span key={group.label}>
                    {group.label}: {group.value}
                  </span>
                ))}
              </dd>
            </div>
            {payments.length > 0 ? (
              <div>
                <dt>Formas de pagamento</dt>
                <dd>{payments.join(', ')}</dd>
              </div>
            ) : null}
          </dl>
        </aside>
      </div>
    </section>
  );
}

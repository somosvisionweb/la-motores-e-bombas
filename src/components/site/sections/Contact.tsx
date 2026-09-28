import { Clock, Mail, MapPin, Navigation } from 'lucide-react';
import { InstagramIcon, WhatsAppIcon } from '@/components/ui/brand-icons';
import { PAYMENT_METHOD_LABEL, isPaymentMethod } from '@/config/payment-methods';
import { addressLines, groupBusinessHours, instagramHandle, phoneDisplay } from '@/lib/company';
import { linkProps, type SiteLinks } from '@/lib/site-links';
import type { SiteData } from '@/server/services/site';

interface CardProps {
  icon: React.ReactNode;
  label: string;
  /** Uma ou mais linhas de texto. */
  lines: string[];
  href?: string | null;
}

function ContactCard({ icon, label, lines, href }: CardProps) {
  const content = (
    <>
      <span className="site-contact-card__icon">{icon}</span>
      <span>
        <small>{label}</small>
        <strong className="site-lines">
          {lines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </strong>
      </span>
    </>
  );
  return href ? (
    <a href={href} className="site-contact-card" {...linkProps(href)}>
      {content}
    </a>
  ) : (
    <div className="site-contact-card">{content}</div>
  );
}

export function Contact({ company, links }: { company: SiteData['company']; links: SiteLinks }) {
  const address = addressLines(company);
  const phone = phoneDisplay(company);
  const instagram = instagramHandle(company);
  const hours = groupBusinessHours(company.hours);
  const payments = company.paymentMethods.filter(isPaymentMethod).map((key) => PAYMENT_METHOD_LABEL[key]);

  return (
    <section id="contato" className="site-section site-section--tint" aria-labelledby="contato-title">
      <div className="site-container site-contact">
        <div className="reveal">
          <p className="site-eyebrow">Contato</p>
          <h2 id="contato-title" className="site-title">
            Fale com a {company.name}
          </h2>
          <p className="site-lead">Chame no WhatsApp para solicitar atendimento ou orçamento, ou venha até o nosso endereço.</p>

          <div className="site-contact__cards" style={{ marginTop: 'var(--space-8)' }}>
            {phone ? <ContactCard icon={<WhatsAppIcon />} label="WhatsApp" lines={[phone]} href={links.general} /> : null}
            {instagram && links.instagram ? <ContactCard icon={<InstagramIcon />} label="Instagram" lines={[instagram]} href={links.instagram} /> : null}
            {company.email ? <ContactCard icon={<Mail aria-hidden="true" />} label="E-mail" lines={[company.email]} href={`mailto:${company.email}`} /> : null}
            {address.length > 0 ? <ContactCard icon={<MapPin aria-hidden="true" />} label="Endereço" lines={address} href={links.maps} /> : null}
          </div>

          <div className="site-actions">
            <a href={links.general} className="btn btn--primary" {...linkProps(links.general)}>
              <WhatsAppIcon /> Falar pelo WhatsApp
            </a>
            {links.instagram ? (
              <a href={links.instagram} className="btn" {...linkProps(links.instagram)}>
                <InstagramIcon /> Instagram
              </a>
            ) : null}
            {address.length > 0 ? (
              <a href={links.maps} className="btn" {...linkProps(links.maps)}>
                <Navigation aria-hidden="true" /> Como chegar
              </a>
            ) : null}
          </div>
        </div>

        <div className="site-fact-card reveal">
          <h3>
            <Clock aria-hidden="true" style={{ display: 'inline', width: 20, height: 20, marginRight: 8, verticalAlign: -3 }} />
            Horário de atendimento
          </h3>
          <ul className="site-hours">
            {hours.map((group) => (
              <li key={group.label}>
                <span>{group.label}</span>
                <strong className={group.closed ? 'closed' : undefined}>{group.value}</strong>
              </li>
            ))}
          </ul>
          {payments.length > 0 ? (
            <div style={{ marginTop: 'var(--space-6)' }}>
              <p className="site-facts-title">Formas de pagamento</p>
              <ul className="site-pay">
                {payments.map((payment) => (
                  <li key={payment}>{payment}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

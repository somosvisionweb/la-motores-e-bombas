import { Clock, MapPin, Phone } from 'lucide-react';
import { fullAddress, groupBusinessHours, phoneDisplay, type CompanyLike } from '@/lib/company';
import { linkProps } from '@/lib/site-links';

/** Faixa superior com endereço, horário e telefone (dados vindos das Configurações da empresa). */
export function SiteTopbar({ company, mapsHref, whatsappHref }: { company: CompanyLike; mapsHref: string; whatsappHref: string }) {
  const address = fullAddress(company);
  const hours = groupBusinessHours(company.hours)
    .filter((group) => !group.closed)
    .map((group) => `${group.label} ${group.value}`)
    .join(' · ');
  const phone = phoneDisplay(company);

  if (!address && !hours && !phone) return null;

  return (
    <div className="site-topbar">
      <div className="site-container site-topbar__inner">
        {address ? (
          <a href={mapsHref} {...linkProps(mapsHref)}>
            <MapPin aria-hidden="true" />
            {address}
          </a>
        ) : null}
        {hours ? (
          <span className="site-topbar__hours">
            <Clock aria-hidden="true" />
            {hours}
          </span>
        ) : null}
        {phone ? (
          <a href={whatsappHref} {...linkProps(whatsappHref)}>
            <Phone aria-hidden="true" />
            {phone}
          </a>
        ) : null}
      </div>
    </div>
  );
}

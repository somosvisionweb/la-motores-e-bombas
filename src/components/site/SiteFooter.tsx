import { BrandMark } from '@/components/system/BrandMark';
import { InstagramIcon, WhatsAppIcon } from '@/components/ui/brand-icons';
import { siteNavHref, type SiteNavItem } from '@/config/site-nav';
import { addressLines, cityLine, instagramHandle, phoneDisplay } from '@/lib/company';
import { linkProps, type SiteLinks } from '@/lib/site-links';
import type { SiteData } from '@/server/services/site';

export function SiteFooter({
  company,
  nav,
  links,
  year,
  storeEnabled,
  privacyEnabled,
}: {
  company: SiteData['company'];
  nav: SiteNavItem[];
  links: SiteLinks;
  year: number;
  storeEnabled: boolean;
  /** A empresa cadastrou a política de privacidade (página /privacidade). */
  privacyEnabled: boolean;
}) {
  const phone = phoneDisplay(company);
  const instagram = instagramHandle(company);
  const address = addressLines(company);
  const city = cityLine(company);

  return (
    <footer className="site-footer">
      <div className="site-container site-footer__grid">
        <div>
          <BrandMark name={company.name} logoFileId={company.logoFileId} surface="dark" fontSize={22} logoHeight={44} />
          <p style={{ marginTop: 'var(--space-4)', maxWidth: '38ch' }}>
            Assistência técnica em motores elétricos e bombas{city ? ` em ${city}` : ''}.
          </p>
        </div>

        <div>
          <h3>Navegação</h3>
          <ul>
            {nav.map((item) => (
              <li key={item.id}>
                <a href={siteNavHref(item, { onHome: false, storeEnabled })}>{item.label}</a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3>Contato</h3>
          <ul>
            {phone ? (
              <li>
                <a href={links.general} {...linkProps(links.general)}>
                  <WhatsAppIcon style={{ display: 'inline', width: 16, height: 16, marginRight: 8, verticalAlign: -3 }} />
                  {phone}
                </a>
              </li>
            ) : null}
            {instagram && links.instagram ? (
              <li>
                <a href={links.instagram} {...linkProps(links.instagram)}>
                  <InstagramIcon style={{ display: 'inline', width: 16, height: 16, marginRight: 8, verticalAlign: -3 }} />
                  {instagram}
                </a>
              </li>
            ) : null}
            {company.email ? (
              <li>
                <a href={`mailto:${company.email}`}>{company.email}</a>
              </li>
            ) : null}
            {address.length > 0 ? (
              <li className="site-lines">
                {address.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      <div className="site-container site-footer__legal">
        <span>
          © {year} {company.name}
          {company.cnpj ? ` · CNPJ ${company.cnpj}` : ''}
        </span>
        <span className="site-footer__links">
          {privacyEnabled ? <a href="/privacidade">Política de privacidade</a> : null}
          <a href="/login">Área restrita</a>
        </span>
      </div>
    </footer>
  );
}

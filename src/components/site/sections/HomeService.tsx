import { PumpBlueprint } from '@/components/ui/Blueprints';
import { WhatsAppIcon } from '@/components/ui/brand-icons';
import { SITE_COPY } from '@/content/site';
import { linkProps, type SiteLinks } from '@/lib/site-links';

/** Atendimento a domicílio: chamada direta para o WhatsApp com mensagem pré-preenchida. */
export function HomeService({ links }: { links: SiteLinks }) {
  return (
    <section id="atendimento" className="site-section" aria-labelledby="atendimento-title">
      <div className="site-container">
        <div className="site-home reveal">
          <div>
            <p className="site-eyebrow">Atendimento a domicílio</p>
            <h2 id="atendimento-title">{SITE_COPY.homeService.title}</h2>
            <p>{SITE_COPY.homeService.text}</p>
            <a href={links.homeVisit} className="btn btn--brand btn--lg" {...linkProps(links.homeVisit)}>
              <WhatsAppIcon /> Solicitar atendimento a domicílio
            </a>
          </div>
          <PumpBlueprint className="site-home__art" labels={false} title="" />
        </div>
      </div>
    </section>
  );
}

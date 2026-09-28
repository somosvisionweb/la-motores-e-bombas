import { ArrowRight, ArrowUpRight, Cog, Droplets, Fan, Wrench, Zap, type LucideIcon } from 'lucide-react';
import { SERVICE_GROUP_INFO } from '@/content/site';
import { linkProps, type SiteLinks } from '@/lib/site-links';
import type { SiteData } from '@/server/services/site';

/** Ícone do grupo (grupos criados pela empresa usam a engrenagem). */
const GROUP_ICON: Record<string, LucideIcon> = { Motores: Cog, Bombas: Droplets, 'Outros equipamentos': Fan };

function featuredIcon(name: string): LucideIcon {
  const text = name.toLowerCase();
  if (text.includes('bomba')) return Droplets;
  if (text.includes('motor')) return Zap;
  return Wrench;
}

export function Services({ groups, links }: { groups: SiteData['serviceGroups']; links: SiteLinks }) {
  if (groups.length === 0) return null;
  const featured = groups.find((group) => group.name === 'Principais');
  const others = groups.filter((group) => group !== featured);

  return (
    <section id="servicos" className="site-section site-section--tint" aria-labelledby="servicos-title">
      <div className="site-container">
        <div className="site-services__head reveal">
          <div>
            <p className="site-eyebrow">Serviços</p>
            <h2 id="servicos-title" className="site-title">
              Serviços para motores, bombas e outros equipamentos
            </h2>
            <p className="site-lead">Escolha o serviço e solicite o seu orçamento pelo WhatsApp.</p>
          </div>
          <a href={links.quote} className="btn btn--primary btn--lg" {...linkProps(links.quote)}>
            Solicitar orçamento <ArrowRight aria-hidden="true" />
          </a>
        </div>

        {featured ? (
          <div className="site-featured">
            {featured.services.map((service, index) => {
              const Icon = featuredIcon(service.name);
              return (
                <a
                  key={service.id}
                  href={links.service(service.name)}
                  className="site-feature reveal"
                  style={{ ['--i' as string]: index }}
                  {...linkProps(links.service(service.name))}
                >
                  <span className="site-feature__icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <h3>{service.name}</h3>
                  {service.description ? <p>{service.description}</p> : null}
                  <span className="site-feature__cta">
                    Pedir orçamento <ArrowRight aria-hidden="true" style={{ display: 'inline', width: 14, height: 14, verticalAlign: -2 }} />
                  </span>
                </a>
              );
            })}
          </div>
        ) : null}

        {others.length > 0 ? (
          <div className="site-groups">
            {others.map((group, index) => {
              const info = SERVICE_GROUP_INFO[group.name];
              const Icon = GROUP_ICON[group.name] ?? Cog;
              return (
                <div key={group.name} className="site-group reveal" style={{ ['--i' as string]: index }}>
                  <div className="site-group__head">
                    <Icon aria-hidden="true" />
                    <div>
                      <h3>{info?.title ?? group.name}</h3>
                    </div>
                  </div>
                  <ul>
                    {group.services.map((service) => (
                      <li key={service.id}>
                        <a href={links.service(service.name)} {...linkProps(links.service(service.name))}>
                          <span>{service.name}</span>
                          <ArrowUpRight aria-hidden="true" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}

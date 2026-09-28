import { MotorBlueprint } from '@/components/ui/Blueprints';
import { SITE_COPY } from '@/content/site';

/** Destaca (em verde) os quatro pilares dentro da frase do cliente, sem alterar o texto. */
function highlightPillars(text: string, terms: string[]): React.ReactNode[] {
  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const parts = text.split(new RegExp(`(${escaped.join('|')})`, 'i'));
  return parts.map((part, index) => (index % 2 === 1 ? <span key={index}>{part}</span> : part));
}

/** "Nosso diferencial": texto do cliente + os quatro pilares citados nele. */
export function Differential() {
  const { differential, pillars } = SITE_COPY;

  return (
    <section id="diferencial" className="site-section site-section--dark" aria-labelledby="diferencial-title">
      <div className="site-container">
        <p className="site-eyebrow site-eyebrow--light reveal">Nosso diferencial</p>
        <div className="site-diff">
          <h2 id="diferencial-title" className="site-diff__quote reveal">
            {highlightPillars(
              differential.quote,
              pillars.map((pillar) => pillar.title),
            )}
          </h2>
          <div className="site-diff__text reveal">
            <p>{differential.evaluation}</p>
            <p>{differential.range}</p>
            <p className="site-diff__closing">{differential.closing}</p>
          </div>
        </div>

        <ol className="site-pillars">
          {pillars.map((pillar, index) => (
            <li key={pillar.title} className="site-pillar reveal" style={{ ['--i' as string]: index }}>
              <span className="site-pillar__n">{String(index + 1).padStart(2, '0')}</span>
              <h3>{pillar.title}</h3>
              <p>{pillar.text}</p>
            </li>
          ))}
        </ol>
      </div>
      <MotorBlueprint className="site-diff__art" labels={false} title="" />
    </section>
  );
}

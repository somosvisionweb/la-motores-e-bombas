import { WhatsAppIcon } from '@/components/ui/brand-icons';
import { linkProps } from '@/lib/site-links';

/** Botão flutuante do WhatsApp (sempre à mão, inclusive no celular). */
export function WhatsAppFab({ href }: { href: string }) {
  return (
    <a href={href} className="site-fab" aria-label="Falar no WhatsApp" {...linkProps(href)}>
      <WhatsAppIcon />
      <span>WhatsApp</span>
    </a>
  );
}

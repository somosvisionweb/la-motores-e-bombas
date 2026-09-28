import { cn } from '@/lib/cn';
import { splitBrandName } from '@/lib/company';

/**
 * Marca da empresa: usa a LOGO enviada em Configurações; enquanto não houver, exibe uma marca tipográfica
 * provisória (apenas o nome — nenhuma logo é inventada).
 */
export function BrandMark({
  name,
  logoFileId,
  surface = 'dark',
  className,
  fontSize = 18,
  logoHeight = 34,
}: {
  name: string;
  logoFileId?: number | null;
  /** Fundo onde a marca aparece: "dark" (sidebar/hero) ou "light". */
  surface?: 'dark' | 'light';
  className?: string;
  fontSize?: number;
  logoHeight?: number;
}) {
  if (logoFileId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/media/${logoFileId}`}
        alt={name}
        className={cn(surface === 'dark' && 'brand-logo-chip', className)}
        style={{ height: logoHeight, width: 'auto', maxWidth: 220, objectFit: 'contain' }}
      />
    );
  }
  const { accent, rest } = splitBrandName(name);
  return (
    <span className={cn('wordmark', surface === 'light' && 'wordmark--dark', className)} style={{ fontSize }}>
      {accent ? <span className="wordmark__la">{accent}</span> : null}
      <span className="wordmark__name">{rest}</span>
    </span>
  );
}

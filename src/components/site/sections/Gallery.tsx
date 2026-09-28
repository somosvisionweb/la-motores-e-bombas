import type { SiteData } from '@/server/services/site';

/** Só aparece quando a empresa envia fotos reais (Configurações → Imagens do site). Nada de imagens de banco. */
export function Gallery({ images, companyName }: { images: SiteData['gallery']; companyName: string }) {
  if (images.length === 0) return null;

  return (
    <section id="galeria" className="site-section site-section--tint" aria-labelledby="galeria-title">
      <div className="site-container">
        <div className="reveal">
          <p className="site-eyebrow">Galeria</p>
          <h2 id="galeria-title" className="site-title">
            Nosso trabalho
          </h2>
        </div>
        <div className="site-gallery">
          {images.map((image, index) => (
            <figure key={image.id} className="reveal" style={{ ['--i' as string]: index % 3 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/media/${image.fileId}`}
                alt={image.alt || `${companyName}: foto do trabalho`}
                width={image.width ?? undefined}
                height={image.height ?? undefined}
                loading="lazy"
              />
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

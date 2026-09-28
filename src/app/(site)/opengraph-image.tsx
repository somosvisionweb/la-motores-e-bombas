import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { SITE_COPY } from '@/content/site';
import { cityLine, instagramHandle, phoneDisplay, splitBrandName } from '@/lib/company';
import { getSiteData } from '@/server/services/site';

// Imagem de compartilhamento (WhatsApp, Instagram, Facebook…): usa os dados atuais da empresa.
export const dynamic = 'force-dynamic';
export const alt = 'LA Motores e Bombas: assistência técnica em motores elétricos e bombas';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const FONT_DIR = path.join(process.cwd(), 'src', 'server', 'documents', 'fonts');
const [barlow, inter] = await Promise.all([
  readFile(path.join(FONT_DIR, 'barlow-semi-condensed-latin-700-normal.woff')),
  readFile(path.join(FONT_DIR, 'inter-latin-500-normal.woff')),
]);

const NAVY = '#0a2240';
const NAVY_DEEP = '#06172b';
const GREEN = '#34d17f';

export default async function OpenGraphImage() {
  const { company } = await getSiteData();
  const { accent, rest } = splitBrandName(company.name);
  const headline = SITE_COPY.heroHeadline;
  const accentAt = headline.indexOf(SITE_COPY.heroAccent);
  const lead = (accentAt > 0 ? headline.slice(0, accentAt) : headline).trim().split(/\s+/);
  const highlighted = accentAt > 0 ? SITE_COPY.heroAccent.split(/\s+/) : [];
  const city = cityLine(company);
  const phone = phoneDisplay(company);
  const instagram = instagramHandle(company);
  const ring = (diameter: number, opacity: number, offset: { right: number; top: number }) => (
    <div
      style={{
        position: 'absolute',
        right: offset.right,
        top: offset.top,
        width: diameter,
        height: diameter,
        display: 'flex',
        borderRadius: 9999,
        border: `2px solid rgba(147, 182, 230, ${opacity})`,
      }}
    />
  );

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: NAVY, color: '#ffffff', fontFamily: 'Inter', overflow: 'hidden' }}>
        {ring(760, 0.22, { right: -250, top: -70 })}
        {ring(600, 0.3, { right: -170, top: 10 })}
        {ring(420, 0.34, { right: -80, top: 100 })}
        {ring(200, 0.4, { right: 30, top: 210 })}
        <div style={{ position: 'absolute', right: 106, top: 286, width: 48, height: 48, display: 'flex', borderRadius: 9999, background: GREEN }} />
        <div style={{ position: 'absolute', left: 0, bottom: 0, width: 300, height: 10, display: 'flex', background: GREEN }} />

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', height: '100%', padding: '64px 76px 66px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', fontFamily: 'Barlow', fontWeight: 700, letterSpacing: 4, fontSize: 40 }}>
            {accent ? <span style={{ color: GREEN, fontSize: 50, marginRight: 14 }}>{accent}</span> : null}
            <span>{rest.toUpperCase()}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', width: 760, columnGap: 20, fontFamily: 'Barlow', fontWeight: 700, fontSize: 84, lineHeight: 1.02 }}>
              {lead.map((word, index) => (
                <span key={`l${index}`}>{word}</span>
              ))}
              {highlighted.map((word, index) => (
                <span key={`h${index}`} style={{ color: GREEN }}>
                  {word}
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', marginTop: 30, fontSize: 28, color: '#c5d8f2' }}>{`Assistência técnica${city ? ` · ${city}` : ''}`}</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', fontSize: 28, color: '#ffffff' }}>
            {phone ? <span style={{ display: 'flex', padding: '10px 22px', borderRadius: 9999, background: NAVY_DEEP, border: `2px solid ${GREEN}` }}>{`WhatsApp ${phone}`}</span> : null}
            {instagram ? <span style={{ display: 'flex', marginLeft: 28, color: '#c5d8f2' }}>{instagram}</span> : null}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Barlow', data: barlow, style: 'normal', weight: 700 },
        { name: 'Inter', data: inter, style: 'normal', weight: 500 },
      ],
    },
  );
}

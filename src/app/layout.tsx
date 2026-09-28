import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/ui.css';

const inter = localFont({
  src: '../assets/fonts/inter-latin-wght-normal.woff2',
  variable: '--font-inter',
  weight: '100 900',
  display: 'swap',
});

const barlow = localFont({
  src: [
    { path: '../assets/fonts/barlow-semi-condensed-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../assets/fonts/barlow-semi-condensed-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: '../assets/fonts/barlow-semi-condensed-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-barlow',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || 'http://localhost:3000'),
  title: { default: 'LA Motores e Bombas', template: '%s | LA Motores e Bombas' },
  applicationName: 'LA Motores e Bombas',
};

export const viewport: Viewport = {
  themeColor: '#0a2240',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${barlow.variable}`}>
      <body>{children}</body>
    </html>
  );
}

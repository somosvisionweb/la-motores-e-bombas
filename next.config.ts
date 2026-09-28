import type { NextConfig } from 'next';

const isProd = process.env.NODE_ENV === 'production';

/**
 * CSP: bloqueia scripts/frames de outras origens. 'unsafe-inline' é necessário para os scripts de hidratação
 * do Next sem nonce; mesmo assim a política impede carregar código externo, incorporar o sistema em iframes
 * e enviar formulários para outros domínios.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isProd ? '' : ' ws: wss:'}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ...(isProd
    ? [
        { key: 'Content-Security-Policy', value: contentSecurityPolicy },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
      ]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Pacotes com binários nativos ou arquivos de dados lidos em tempo de execução ficam fora do bundle.
  serverExternalPackages: ['@libsql/client', 'libsql', 'pdfkit', 'sharp', 'qrcode'],
  experimental: {
    // Upload de logo/imagens (até 6 MB) via Server Actions.
    serverActions: { bodySizeLimit: '8mb' },
  },
  // Em hospedagem "standalone", inclui as migrações e as fontes dos PDFs no pacote final.
  outputFileTracingIncludes: {
    '/**': ['./drizzle/**/*', './src/server/documents/fonts/**/*'],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;

import { isProductIconKey } from '@/config/product-icons';

const deg = (a: number) => (a * Math.PI) / 180;
const pt = (r: number, a: number): [number, number] => [
  Math.round((24 + r * Math.sin(deg(a))) * 100) / 100,
  Math.round((24 - r * Math.cos(deg(a))) * 100) / 100,
];

/**
 * Ícones técnicos ORIGINAIS (linha) para componentes de motores e bombas.
 * Usados no site e no sistema quando o produto não tem foto real.
 */
export function ProductIcon({ iconKey, size = 44, className }: { iconKey?: string | null; size?: number; className?: string }) {
  const key = isProductIconKey(iconKey) ? iconKey : 'component';
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {ICONS[key]()}
    </svg>
  );
}

const ICONS: Record<string, () => React.ReactNode> = {
  bearing: () => (
    <>
      <circle cx="24" cy="24" r="18" />
      <circle cx="24" cy="24" r="7.5" />
      {Array.from({ length: 8 }, (_, i) => {
        const [x, y] = pt(12.75, i * 45);
        return <circle key={i} cx={x} cy={y} r="2.7" />;
      })}
    </>
  ),
  'mechanical-seal': () => (
    <>
      <circle cx="24" cy="24" r="18" />
      <circle cx="24" cy="24" r="13.5" />
      <circle cx="24" cy="24" r="8" />
      {Array.from({ length: 6 }, (_, i) => {
        const [x1, y1] = pt(8.6, i * 60 + 30);
        const [x2, y2] = pt(13, i * 60 + 30);
        return <path key={i} d={`M${x1} ${y1}L${x2} ${y2}`} strokeWidth="2.6" />;
      })}
    </>
  ),
  'capacitor-run': () => (
    <>
      <rect x="11" y="12" width="26" height="28" rx="4" />
      <path d="M18 12V6M30 12V6" />
      <path d="M16 22h16M16 27h16" strokeWidth="2.4" />
      <path d="M24 22v-4M24 27v4" />
    </>
  ),
  'capacitor-electrolytic': () => (
    <>
      <rect x="13" y="8" width="22" height="30" rx="3" />
      <path d="M13 14h22" />
      <path d="M19 38v6M29 38v6" />
      <rect x="13" y="14" width="6" height="24" fill="currentColor" stroke="none" opacity="0.18" />
      <path d="M16 26h0.01M24 22l0 8M20 26h8" strokeWidth="1.6" />
    </>
  ),
  'centrifugal-switch': () => (
    <>
      <circle cx="24" cy="24" r="5.5" />
      <circle cx="24" cy="24" r="1.4" fill="currentColor" />
      <path d="M20 20L11 12M28 28L37 36" />
      <circle cx="9" cy="10" r="4.5" />
      <circle cx="39" cy="38" r="4.5" />
      <path d="M27 20c4-2 6-6 6-10M21 28c-4 2-6 6-6 10" strokeDasharray="2.4 2.4" />
      <rect x="4" y="40" width="40" height="4" rx="1.5" opacity="0.5" />
    </>
  ),
  contacts: () => (
    <>
      <path d="M8 10l12 12" />
      <path d="M40 38L28 26" />
      <path d="M19 26.5a5 5 0 0 1 7.2-7.2" />
      <path d="M29 21.5a5 5 0 0 1-7.2 7.2" />
      <path d="M31 12l4-4M36 17l5-1M14 36l-4 4" strokeWidth="1.4" opacity="0.7" />
    </>
  ),
  fan: () => (
    <>
      <circle cx="24" cy="24" r="19" opacity="0.55" />
      {Array.from({ length: 5 }, (_, i) => (
        <path key={i} d="M24 21c-5-3-5-12 1-13.5 4.5-1 7 4 5.5 8-1 2.7-3.5 4.6-6.5 5.5z" transform={`rotate(${i * 72} 24 24)`} />
      ))}
      <circle cx="24" cy="24" r="3.4" fill="currentColor" stroke="none" />
    </>
  ),
  'end-cap': () => (
    <>
      <circle cx="24" cy="24" r="19" />
      <circle cx="24" cy="24" r="12.5" />
      <circle cx="24" cy="24" r="5" />
      {[45, 135, 225, 315].map((a) => {
        const [x, y] = pt(15.8, a);
        return <circle key={a} cx={x} cy={y} r="1.6" fill="currentColor" stroke="none" />;
      })}
      <path d="M24 5v3.5M24 39.5V43M5 24h3.5M39.5 24H43" opacity="0.6" />
    </>
  ),
  gauge: () => (
    <>
      <circle cx="24" cy="22" r="17" />
      <circle cx="24" cy="22" r="2.6" fill="currentColor" />
      {Array.from({ length: 7 }, (_, i) => {
        const a = -120 + i * 40;
        const [x1, y1] = [24 + 13 * Math.sin(deg(a)), 22 - 13 * Math.cos(deg(a))];
        const [x2, y2] = [24 + 16 * Math.sin(deg(a)), 22 - 16 * Math.cos(deg(a))];
        return <path key={i} d={`M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}`} />;
      })}
      <path d="M24 22l8-9" strokeWidth="2.2" />
      <path d="M21 39h6v5h-6z" />
    </>
  ),
  pulley: () => (
    <>
      <circle cx="24" cy="24" r="19" />
      <circle cx="24" cy="24" r="14.5" />
      <circle cx="24" cy="24" r="5" />
      <circle cx="24" cy="24" r="1.6" fill="currentColor" />
      {[0, 90, 180, 270].map((a) => {
        const [x1, y1] = pt(5.4, a + 45);
        const [x2, y2] = pt(14.2, a + 45);
        return <path key={a} d={`M${x1} ${y1}L${x2} ${y2}`} strokeWidth="2.2" />;
      })}
    </>
  ),
  rotor: () => (
    <>
      <circle cx="24" cy="24" r="19" />
      <circle cx="24" cy="24" r="12" opacity="0.7" />
      <circle cx="24" cy="24" r="4.4" />
      <path d="M22 19.6v-3h4v3" strokeWidth="1.5" />
      {Array.from({ length: 14 }, (_, i) => {
        const [x1, y1] = pt(14.8, i * (360 / 14));
        const [x2, y2] = pt(17.6, i * (360 / 14));
        return <path key={i} d={`M${x1} ${y1}L${x2} ${y2}`} strokeWidth="2.4" />;
      })}
    </>
  ),
  component: () => (
    <>
      <rect x="11" y="11" width="26" height="26" rx="4" />
      <rect x="18" y="18" width="12" height="12" rx="2" />
      <path d="M17 11V6M24 11V6M31 11V6M17 42v-5M24 42v-5M31 42v-5M11 17H6M11 24H6M11 31H6M42 17h-5M42 24h-5M42 31h-5" />
    </>
  ),
};

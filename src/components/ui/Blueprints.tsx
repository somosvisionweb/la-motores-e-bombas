/**
 * Ilustrações técnicas ORIGINAIS (SVG vetorial) no estilo de prancha de engenharia.
 * Servem de identidade visual enquanto a empresa não envia fotos reais (Configurações → Imagens do site).
 * Traço em `currentColor`; cores das fases/acentos vêm de variáveis CSS (--bp-a, --bp-b, --bp-c).
 */
const rad = (deg: number) => (deg * Math.PI) / 180;
/** 0° no topo, sentido horário. */
const polar = (r: number, deg: number): [number, number] => [
  Math.round(r * Math.sin(rad(deg)) * 100) / 100,
  Math.round(-r * Math.cos(rad(deg)) * 100) / 100,
];

const CENTER_DASH = '16 4 3 4';

interface BlueprintProps {
  className?: string;
  /** Mostra as chamadas (ESTATOR, ENROLAMENTO…). */
  labels?: boolean;
  /** Descrição para leitores de tela; vazio = ilustração decorativa (oculta da acessibilidade). */
  title?: string;
}

const a11y = (title: string) => (title ? { role: 'img' as const, 'aria-label': title } : { 'aria-hidden': true as const });

export function MotorBlueprint({ className, labels = true, title = 'Ilustração técnica: corte frontal de um motor elétrico' }: BlueprintProps) {
  const slots = Array.from({ length: 24 }, (_, i) => i * 15);
  const bars = Array.from({ length: 22 }, (_, i) => (i * 360) / 22);
  const vents = Array.from({ length: 6 }, (_, i) => polar(40, i * 60 + 30));
  const [ex, ey] = polar(143, 58);
  const [wx, wy] = polar(121, 90);
  const [rx, ry] = polar(72, 122);

  return (
    <svg
      viewBox="-200 -190 540 380"
      {...a11y(title)}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* linhas de centro */}
      <g strokeDasharray={CENTER_DASH} strokeWidth="1" opacity="0.5">
        <path d="M-190 0H190M0-182V182" />
      </g>

      {/* carcaça */}
      <circle r="166" opacity="0.9" />
      <circle r="153" />

      {/* ranhuras do estator com o enrolamento (3 fases) */}
      {slots.map((angle, i) => (
        <g key={angle} transform={`rotate(${angle})`}>
          <rect x="-5.5" y="-136" width="11" height="28" rx="2.4" />
          <rect x="-3.4" y="-133" width="6.8" height="22" rx="1.6" fill={`var(--bp-${['a', 'b', 'c'][i % 3]})`} stroke="none" opacity="0.95" />
        </g>
      ))}
      <circle r="107" />

      {/* rotor */}
      <circle r="99" opacity="0.85" />
      {bars.map((angle) => (
        <rect key={angle} x="-2.6" y="-93" width="5.2" height="11" rx="1.4" transform={`rotate(${angle})`} opacity="0.85" />
      ))}
      <circle r="62" opacity="0.7" />
      {vents.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="9" opacity="0.8" />
      ))}

      {/* eixo e chaveta */}
      <circle r="22" strokeWidth="1.8" />
      <path d="M-4.5-22v-6h9v6" strokeWidth="1.4" />
      <circle r="2.4" fill="currentColor" stroke="none" />

      {labels ? (
        <g strokeWidth="0.9" opacity="0.9">
          <g>
            <circle cx={ex} cy={ey} r="2.6" fill="currentColor" stroke="none" />
            <path d={`M${ex} ${ey}L176 -108H214`} />
          </g>
          <g>
            <circle cx={wx} cy={wy} r="2.6" fill="currentColor" stroke="none" />
            <path d={`M${wx} ${wy}L176 -8H214`} />
          </g>
          <g>
            <circle cx={rx} cy={ry} r="2.6" fill="currentColor" stroke="none" />
            <path d={`M${rx} ${ry}L176 96H214`} />
          </g>
          <g fill="currentColor" stroke="none" fontFamily="var(--font-display)" fontSize="12.5" fontWeight="600" letterSpacing="1.6">
            <text x="220" y="-104">
              ESTATOR
            </text>
            <text x="220" y="-4">
              ENROLAMENTO
            </text>
            <text x="220" y="100">
              ROTOR
            </text>
          </g>
        </g>
      ) : null}
    </svg>
  );
}

export function PumpBlueprint({ className, labels = true, title = 'Ilustração técnica: bomba centrífuga em vista frontal' }: BlueprintProps) {
  const vanes = Array.from({ length: 7 }, (_, i) => (i * 360) / 7);
  const bolts = Array.from({ length: 8 }, (_, i) => polar(93, i * 45 + 22.5));
  const [ix, iy] = polar(52, 215);

  return (
    <svg
      viewBox="-150 -190 330 330"
      {...a11y(title)}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g strokeDasharray={CENTER_DASH} strokeWidth="1" opacity="0.5">
        <path d="M-135 0H135M0-45V125M110-185V-30" />
      </g>

      {/* bocal de saída (tangencial) */}
      <path d="M88 -6V-146M132 -6V-146" />
      <path d="M78 -146H142V-158H78Z" />
      <circle cx="90" cy="-152" r="2.2" opacity="0.8" />
      <circle cx="130" cy="-152" r="2.2" opacity="0.8" />

      {/* voluta */}
      <circle r="102" />
      <circle r="88" opacity="0.8" />
      {bolts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.4" opacity="0.85" />
      ))}

      {/* rotor (impelidor) com pás curvas */}
      <circle r="66" opacity="0.9" />
      {vanes.map((angle) => (
        <path key={angle} d="M17 -2C34 -30 52 -30 62 -14" transform={`rotate(${angle})`} strokeWidth="1.8" />
      ))}
      <circle r="30" strokeDasharray="4 4" opacity="0.6" />
      <circle r="15" strokeWidth="1.8" />
      <circle r="3" fill="currentColor" stroke="none" />

      {/* fluxo */}
      <g stroke="var(--bp-a)" strokeWidth="2" opacity="0.95">
        <path d="M110 -100V-128" />
        <path d="M104 -118l6 -12l6 12" />
      </g>

      {labels ? (
        <g strokeWidth="0.9" opacity="0.9">
          <circle cx={ix} cy={iy} r="2.6" fill="currentColor" stroke="none" />
          <path d={`M${ix} ${iy}L-88 92H-140`} />
          <circle cx="110" cy="-60" r="2.6" fill="currentColor" stroke="none" />
          <path d="M110 -60L150 -60" />
          <g fill="currentColor" stroke="none" fontFamily="var(--font-display)" fontSize="12.5" fontWeight="600" letterSpacing="1.6">
            <text x="-140" y="112">
              IMPELIDOR
            </text>
            <text x="120" y="-38">
              VOLUTA
            </text>
          </g>
        </g>
      ) : null}
    </svg>
  );
}

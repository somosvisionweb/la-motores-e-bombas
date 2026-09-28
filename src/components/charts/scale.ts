/** Escalas "bonitas" e formatação compacta para os gráficos. */
export function niceScale(maxValue: number, opts: { targetTicks?: number; integer?: boolean } = {}): { max: number; step: number; ticks: number[] } {
  const target = opts.targetTicks ?? 4;
  if (!Number.isFinite(maxValue) || maxValue <= 0) {
    const step = opts.integer ? 1 : 1;
    return { max: step * target, step, ticks: Array.from({ length: target + 1 }, (_, i) => i * step) };
  }
  const rough = maxValue / target;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  let step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10) * magnitude;
  if (opts.integer) step = Math.max(1, Math.ceil(step));
  const max = Math.ceil(maxValue / step) * step;
  const ticks: number[] = [];
  for (let value = 0; value <= max + step / 1000; value += step) ticks.push(Math.round(value * 1000) / 1000);
  return { max, step, ticks };
}

const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

/** Centavos em formato curto para eixos: "R$ 850", "R$ 1,5 mil", "R$ 2 mi". */
export function formatCompactBRL(cents: number): string {
  const value = cents / 100;
  if (Math.abs(value) < 1000) return `R$ ${Math.round(value).toLocaleString('pt-BR')}`;
  return `R$ ${compact.format(value)}`;
}

export function formatCompactInt(value: number): string {
  return Math.abs(value) < 1000 ? String(Math.round(value)) : compact.format(value);
}

/** Quantos rótulos do eixo X mostrar sem colisão (mostra 1 a cada `step`). */
export function labelStep(count: number): number {
  if (count <= 8) return 1;
  if (count <= 16) return 2;
  if (count <= 31) return 3;
  if (count <= 62) return 6;
  return Math.ceil(count / 10);
}

/**
 * Valor por extenso em português (usado em recibos).
 * Ex.: 123456 (centavos) → "mil duzentos e trinta e quatro reais e cinquenta e seis centavos"
 */
const UNITS = [
  'zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez',
  'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove',
];
const TENS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const HUNDREDS = [
  '', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos',
];

/** 1–999 em palavras (masculino). */
function belowThousand(n: number): string {
  if (n === 100) return 'cem';
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds) parts.push(HUNDREDS[hundreds]!);
  if (rest) {
    if (rest < 20) parts.push(UNITS[rest]!);
    else {
      const unit = rest % 10;
      parts.push(unit ? `${TENS[Math.floor(rest / 10)]} e ${UNITS[unit]}` : TENS[Math.floor(rest / 10)]!);
    }
  }
  return parts.join(' e ');
}

const SCALES = [
  { value: 1_000_000_000, singular: 'bilhão', plural: 'bilhões' },
  { value: 1_000_000, singular: 'milhão', plural: 'milhões' },
  { value: 1_000, singular: 'mil', plural: 'mil' },
];

/** Inteiro não negativo em palavras (masculino). */
export function numberToWords(value: number): string {
  if (!Number.isInteger(value) || value < 0) throw new RangeError('numberToWords espera um inteiro não negativo');
  if (value === 0) return 'zero';

  const chunks: { text: string; group: number }[] = [];
  let remainder = value;
  for (const scale of SCALES) {
    const count = Math.floor(remainder / scale.value);
    remainder %= scale.value;
    if (count === 0) continue;
    const label = count === 1 ? scale.singular : scale.plural;
    // "mil" (e não "um mil") quando o grupo é exatamente 1 milhar
    const text = count === 1 && scale.value === 1_000 ? label : `${belowThousand(count)} ${label}`;
    chunks.push({ text, group: count });
  }
  if (remainder > 0) chunks.push({ text: belowThousand(remainder), group: remainder });

  if (chunks.length === 1) return chunks[0]!.text;

  // Conector "e" antes do último bloco quando ele é menor que 100 ou centena exata.
  const last = chunks[chunks.length - 1]!;
  const needsE = last.group < 100 || last.group % 100 === 0;
  const head = chunks.slice(0, -1).map((c) => c.text).join(' ');
  return `${head}${needsE ? ' e ' : ' '}${last.text}`;
}

/** Valor em centavos por extenso ("um real", "dois reais e cinquenta centavos"). */
export function moneyToWords(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) throw new RangeError('moneyToWords espera centavos inteiros não negativos');
  const reais = Math.floor(cents / 100);
  const centavos = cents % 100;

  const parts: string[] = [];
  if (reais > 0 || centavos === 0) {
    const de = reais >= 1_000_000 && reais % 1_000_000 === 0 ? ' de' : '';
    parts.push(`${numberToWords(reais)}${de} ${reais === 1 ? 'real' : 'reais'}`);
  }
  if (centavos > 0) parts.push(`${numberToWords(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`);
  return parts.join(' e ');
}

/** "3 (três) meses" / "1 (um) mês" — usado no prazo de garantia. */
export function formatMonthsInWords(months: number): string {
  const unit = months === 1 ? 'mês' : 'meses';
  return `${months} (${numberToWords(months)}) ${unit}`;
}

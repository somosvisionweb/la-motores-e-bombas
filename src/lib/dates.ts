/**
 * Datas de negócio.
 *
 * - Campos "somente data" (entrada, entrega, pagamento…) são strings ISO `YYYY-MM-DD`
 *   no fuso da empresa, então não sofrem deslocamento de fuso ao serem exibidos.
 * - Carimbos de tempo (criado em, atualizado em) são `Date` (epoch ms no banco).
 */
export const DEFAULT_TIMEZONE = 'America/Recife';

export type ISODate = string;

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string') return false;
  const m = ISO_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

function toUTC(iso: ISODate): Date {
  const m = ISO_RE.exec(iso);
  if (!m) throw new RangeError(`Data inválida: ${iso}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function fromUTC(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

/** Data de hoje (YYYY-MM-DD) no fuso informado. */
export function todayISO(timezone: string = DEFAULT_TIMEZONE, now: Date = new Date()): ISODate {
  return dateOnlyInTimezone(now, timezone);
}

/** Converte um instante para a data local (YYYY-MM-DD) no fuso informado. */
export function dateOnlyInTimezone(date: Date, timezone: string = DEFAULT_TIMEZONE): ISODate {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Início (00:00:00.000) ou fim (23:59:59.999) do dia `iso` no fuso informado, em milissegundos UTC.
 * Usado para filtrar carimbos de tempo (ex.: clientes cadastrados no período) sem fixar o fuso no código.
 */
export function zonedDayBoundMs(iso: ISODate, timezone: string, bound: 'start' | 'end'): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const guess = bound === 'start' ? Date.UTC(y, m - 1, d, 0, 0, 0, 0) : Date.UTC(y, m - 1, d, 23, 59, 59, 999);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(guess));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const localAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'), bound === 'start' ? 0 : 999);
  return guess - (localAsUtc - guess);
}

export function addDaysISO(iso: ISODate, days: number): ISODate {
  const d = toUTC(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUTC(d);
}

export function addMonthsISO(iso: ISODate, months: number): ISODate {
  const d = toUTC(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return fromUTC(d);
}

export function startOfMonthISO(iso: ISODate): ISODate {
  return `${iso.slice(0, 7)}-01`;
}

export function endOfMonthISO(iso: ISODate): ISODate {
  const d = toUTC(iso);
  return fromUTC(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
}

/** Diferença em dias (b − a). */
export function diffDaysISO(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / 86_400_000);
}

export function compareISO(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function eachDayISO(from: ISODate, to: ISODate): ISODate[] {
  const days: ISODate[] = [];
  for (let d = from; d <= to; d = addDaysISO(d, 1)) {
    days.push(d);
    if (days.length > 3700) break; // trava de segurança (~10 anos)
  }
  return days;
}

/** "24/09/2026" — retorna "—" quando vazio. */
export function formatDateBR(iso: ISODate | null | undefined): string {
  if (!iso || !ISO_RE.test(iso)) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** "24/09" */
export function formatDayMonthBR(iso: ISODate): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function monthName(monthIndex0: number): string {
  return MONTHS[monthIndex0] ?? '';
}

/** "setembro de 2026" */
export function formatMonthYearBR(iso: ISODate): string {
  const [y, m] = iso.split('-');
  return `${MONTHS[Number(m) - 1]} de ${y}`;
}

/** "24 de setembro de 2026" */
export function formatLongDateBR(iso: ISODate): string {
  const [y, m, d] = iso.split('-');
  return `${Number(d)} de ${MONTHS[Number(m) - 1]} de ${y}`;
}

const WEEKDAY_NAMES = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

/** "quinta-feira, 24 de setembro de 2026" */
export function formatLongDateWithWeekdayBR(iso: ISODate): string {
  const dow = toUTC(iso).getUTCDay();
  return `${WEEKDAY_NAMES[dow]}, ${formatLongDateBR(iso)}`;
}

/** "24 set" */
export function formatShortDateBR(iso: ISODate): string {
  const [, m, d] = iso.split('-');
  return `${Number(d)} ${MONTHS_SHORT[Number(m) - 1]}`;
}

/** "24/09/2026 14:35" no fuso da empresa. */
export function formatDateTimeBR(date: Date | null | undefined, timezone: string = DEFAULT_TIMEZONE): string {
  if (!date) return '—';
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return parts.replace(',', '');
}

/** Descrição relativa curta: "hoje", "ontem", "há 3 dias". */
export function relativeDaysLabel(iso: ISODate, today: ISODate): string {
  const diff = diffDaysISO(iso, today);
  if (diff === 0) return 'hoje';
  if (diff === 1) return 'ontem';
  if (diff === -1) return 'amanhã';
  if (diff > 1) return `há ${diff} dias`;
  return `em ${Math.abs(diff)} dias`;
}

// --- Períodos usados em filtros (dashboard, relatórios, financeiro) ---

export const PERIOD_KEYS = ['hoje', '7d', '30d', 'mes', 'mes-anterior', 'personalizado'] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];

export const PERIOD_LABEL: Record<PeriodKey, string> = {
  hoje: 'Hoje',
  '7d': '7 dias',
  '30d': '30 dias',
  mes: 'Este mês',
  'mes-anterior': 'Mês anterior',
  personalizado: 'Personalizado',
};

export interface Period {
  key: PeriodKey;
  from: ISODate;
  to: ISODate;
  /** Nome curto do período ("30 dias", "Este mês", "01/09/2026 a 10/09/2026"). */
  short: string;
  label: string;
  /** Quantidade de dias do intervalo (inclusive). */
  days: number;
}

export function isPeriodKey(value: unknown): value is PeriodKey {
  return typeof value === 'string' && (PERIOD_KEYS as readonly string[]).includes(value);
}

/**
 * Resolve um período nomeado para datas.
 * Para "personalizado", `custom.from/to` são validados; se inválidos, cai em "30 dias".
 */
export function resolvePeriod(
  key: PeriodKey | string | undefined,
  today: ISODate,
  custom?: { from?: string; to?: string },
): Period {
  const safeKey: PeriodKey = isPeriodKey(key) ? key : '30d';
  let from: ISODate;
  let to: ISODate;
  let resolvedKey: PeriodKey = safeKey;

  switch (safeKey) {
    case 'hoje':
      from = to = today;
      break;
    case '7d':
      from = addDaysISO(today, -6);
      to = today;
      break;
    case 'mes':
      from = startOfMonthISO(today);
      to = today;
      break;
    case 'mes-anterior': {
      const prev = addMonthsISO(startOfMonthISO(today), -1);
      from = prev;
      to = endOfMonthISO(prev);
      break;
    }
    case 'personalizado': {
      if (isISODate(custom?.from) && isISODate(custom?.to)) {
        from = custom.from <= custom.to ? custom.from : custom.to;
        to = custom.from <= custom.to ? custom.to : custom.from;
      } else {
        from = addDaysISO(today, -29);
        to = today;
        resolvedKey = '30d';
      }
      break;
    }
    case '30d':
    default:
      from = addDaysISO(today, -29);
      to = today;
      break;
  }

  const days = diffDaysISO(from, to) + 1;
  const label =
    resolvedKey === 'personalizado'
      ? `${formatDateBR(from)} a ${formatDateBR(to)}`
      : resolvedKey === 'hoje'
        ? 'Hoje'
        : `${PERIOD_LABEL[resolvedKey]} (${formatDateBR(from)} a ${formatDateBR(to)})`;
  const short = resolvedKey === 'personalizado' ? `${formatDateBR(from)} a ${formatDateBR(to)}` : PERIOD_LABEL[resolvedKey];
  return { key: resolvedKey, from, to, short, label, days };
}

/** Granularidade ideal para séries temporais conforme a duração do período. */
export function bucketFor(days: number): 'day' | 'week' | 'month' {
  if (days <= 45) return 'day';
  if (days <= 190) return 'week';
  return 'month';
}

/** Início do bucket (dia, segunda-feira da semana ou 1º dia do mês) que contém a data. */
export function bucketStart(iso: ISODate, bucket: 'day' | 'week' | 'month'): ISODate {
  if (bucket === 'day') return iso;
  if (bucket === 'month') return startOfMonthISO(iso);
  const dow = toUTC(iso).getUTCDay(); // 0 = domingo
  const offset = dow === 0 ? 6 : dow - 1;
  return addDaysISO(iso, -offset);
}

/** Lista contínua de inícios de bucket entre from e to (inclusive). */
export function bucketsBetween(from: ISODate, to: ISODate, bucket: 'day' | 'week' | 'month'): ISODate[] {
  const result: ISODate[] = [];
  let cursor = bucketStart(from, bucket);
  while (cursor <= to) {
    result.push(cursor);
    cursor = bucket === 'day' ? addDaysISO(cursor, 1) : bucket === 'week' ? addDaysISO(cursor, 7) : addMonthsISO(cursor, 1);
    if (result.length > 800) break;
  }
  return result;
}

export function formatBucketLabel(start: ISODate, bucket: 'day' | 'week' | 'month'): string {
  if (bucket === 'month') {
    const [y, m] = start.split('-');
    return `${MONTHS_SHORT[Number(m) - 1]}/${y.slice(2)}`;
  }
  return formatDayMonthBR(start);
}

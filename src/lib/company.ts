import { WEEKDAY_KEYS, WEEKDAY_LABEL, WEEKDAY_SHORT, type BusinessHours, type DaySchedule } from '@/config/company';
import { displayPhone, buildWhatsAppUrl } from './phone';
import { joinParts, applyTemplate } from './text';

export interface CompanyLike {
  name: string;
  cnpj?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  instagram?: string | null;
  hours: BusinessHours;
}

/** "LA Motores e Bombas" → { accent: "LA", rest: "Motores e Bombas" } (a sigla ganha destaque na marca tipográfica). */
export function splitBrandName(name: string): { accent: string | null; rest: string } {
  const [first, ...others] = name.trim().split(/\s+/);
  if (first && others.length > 0 && first.length <= 3 && first === first.toUpperCase()) {
    return { accent: first, rest: others.join(' ') };
  }
  return { accent: null, rest: name };
}

/** "Rua Serafim Luiz Pinto, 15" */
export function streetLine(company: CompanyLike): string {
  return company.address?.trim() ?? '';
}

/** "Jaboatão dos Guararapes - PE" */
export function cityLine(company: CompanyLike): string {
  return joinParts([company.city, company.state], ' - ');
}

/** "Rua Serafim Luiz Pinto, 15 - Jaboatão dos Guararapes - PE" */
export function fullAddress(company: CompanyLike): string {
  return joinParts([streetLine(company), cityLine(company)], ' - ');
}

/** Endereço em duas linhas (rua e número / cidade e UF), para cartões e rodapé. */
export function addressLines(company: CompanyLike): string[] {
  return [streetLine(company), cityLine(company)].filter(Boolean);
}

export function phoneDisplay(company: CompanyLike): string {
  return displayPhone(company.phone || company.whatsapp);
}

export function instagramHandle(company: CompanyLike): string {
  const raw = (company.instagram ?? '').trim();
  if (!raw) return '';
  const handle = raw.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/?#].*$/, '').replace(/^@/, '');
  return handle ? `@${handle}` : '';
}

export function instagramUrl(company: CompanyLike): string {
  const handle = instagramHandle(company);
  return handle ? `https://www.instagram.com/${handle.slice(1)}/` : '';
}

/** Link "Como chegar" (busca no Google Maps pelo endereço cadastrado). */
export function mapsUrl(company: CompanyLike): string {
  const query = fullAddress(company);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function sameSchedule(a: DaySchedule, b: DaySchedule): boolean {
  if (a.closed && b.closed) return true;
  return a.closed === b.closed && a.open === b.open && a.close === b.close;
}

export interface HoursGroup {
  /** "Segunda a sexta", "Sábado" */
  label: string;
  /** "08:00 às 17:00" ou "Fechado" */
  value: string;
  closed: boolean;
  days: (typeof WEEKDAY_KEYS)[number][];
}

/** Agrupa dias consecutivos com o mesmo horário: [Seg–Sex 08:00–17:00, Sáb 08:00–12:00, Dom fechado]. */
export function groupBusinessHours(hours: BusinessHours): HoursGroup[] {
  const groups: HoursGroup[] = [];
  for (const day of WEEKDAY_KEYS) {
    const schedule = hours[day];
    const last = groups[groups.length - 1];
    if (last && sameSchedule(hours[last.days[0]!], schedule)) {
      last.days.push(day);
    } else {
      groups.push({
        label: '',
        value: schedule.closed ? 'Fechado' : `${schedule.open} às ${schedule.close}`,
        closed: schedule.closed,
        days: [day],
      });
    }
  }
  for (const group of groups) {
    const first = group.days[0]!;
    const last = group.days[group.days.length - 1]!;
    if (group.days.length === 1) group.label = WEEKDAY_LABEL[first].replace('-feira', '');
    else if (group.days.length === 7) group.label = 'Todos os dias';
    else group.label = `${WEEKDAY_SHORT[first]} a ${WEEKDAY_SHORT[last].toLowerCase()}`;
  }
  return groups;
}

/** Uma linha por grupo: "Segunda a sexta — 08:00 às 17:00". */
export function hoursLines(hours: BusinessHours): string[] {
  return groupBusinessHours(hours).map((g) => `${g.label} — ${g.value}`);
}

const SCHEMA_DAY: Record<(typeof WEEKDAY_KEYS)[number], string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

/** Para dados estruturados (schema.org OpeningHoursSpecification). */
export function openingHoursSpecification(hours: BusinessHours) {
  return WEEKDAY_KEYS.filter((d) => !hours[d].closed && hours[d].open && hours[d].close).map((d) => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: SCHEMA_DAY[d],
    opens: hours[d].open!,
    closes: hours[d].close!,
  }));
}

export function whatsappLink(company: CompanyLike, message: string): string | null {
  if (!company.whatsapp) return null;
  return buildWhatsAppUrl(company.whatsapp, message);
}

export function renderCompanyMessage(template: string, company: CompanyLike, extra: Record<string, string> = {}): string {
  return applyTemplate(template, { empresa: company.name, ...extra });
}

/** Remove acentos e padroniza caixa/espaços — base das buscas (ex.: "João" → "joao"). */
export function normalizeSearch(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function onlyDigits(input: string | null | undefined): string {
  return (input ?? '').replace(/\D+/g, '');
}

/** Escapa curingas do LIKE (%, _ e \) para busca literal. */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function slugify(input: string): string {
  return normalizeSearch(input)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function initials(name: string | null | undefined, max = 2): string {
  if (!name) return '?';
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0] ?? '';
  if (words.length === 1) return first.slice(0, max).toUpperCase();
  return words
    .filter((w) => w.length > 2 || words.length <= 2)
    .slice(0, max)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

export function truncate(input: string | null | undefined, max: number): string {
  if (!input) return '';
  return input.length > max ? `${input.slice(0, max - 1).trimEnd()}…` : input;
}

/** Une partes não vazias: joinParts(['Rua A', '', 'Recife'], ' – ') → "Rua A – Recife". */
export function joinParts(parts: (string | null | undefined)[], separator = ', '): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join(separator);
}

export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

/** Substitui placeholders {{chave}} por valores (chaves ausentes viram texto vazio). */
export function applyTemplate(template: string, values: Record<string, string | number | null | undefined>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => String(values[key] ?? ''));
}

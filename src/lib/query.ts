/** Utilitários para filtros/ordenação/paginação baseados na URL (searchParams). */
export type SearchParams = Record<string, string | string[] | undefined>;

export const DEFAULT_PAGE_SIZE = 20;

export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function param(params: SearchParams, key: string): string {
  return (firstParam(params[key]) ?? '').trim();
}

/** Todos os valores de um parâmetro repetido (?status=A&status=B). */
export function paramList(params: SearchParams, key: string): string[] {
  const raw = params[key];
  if (raw === undefined) return [];
  return (Array.isArray(raw) ? raw : [raw]).map((v) => v.trim()).filter(Boolean);
}

export function parsePage(params: SearchParams, key = 'pagina'): number {
  const n = Number(param(params, key));
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export type SortDir = 'asc' | 'desc';

export function parseSort<T extends string>(
  params: SearchParams,
  allowed: readonly T[],
  fallback: { key: T; dir: SortDir },
): { key: T; dir: SortDir } {
  const key = param(params, 'ordem') as T;
  const dir = param(params, 'dir') === 'asc' ? 'asc' : param(params, 'dir') === 'desc' ? 'desc' : undefined;
  if (allowed.includes(key)) return { key, dir: dir ?? fallback.dir };
  return fallback;
}

/** Monta uma URL preservando os parâmetros atuais e aplicando alterações (null/'' remove). */
export function buildHref(
  basePath: string,
  params: SearchParams,
  overrides: Record<string, string | number | null | undefined> = {},
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key in overrides) continue;
    if (Array.isArray(value)) value.forEach((v) => v && query.append(key, v));
    else if (value) query.set(key, value);
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== null && value !== undefined && value !== '') query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function offsetFor(page: number, pageSize = DEFAULT_PAGE_SIZE): number {
  return (page - 1) * pageSize;
}

export function totalPages(total: number, pageSize = DEFAULT_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

import { and, sql, type SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';
import { escapeLike, normalizeSearch } from '@/lib/text';

/** Cada palavra da busca precisa aparecer no texto normalizado (sem acento, minúsculo). */
export function likeAllTokens(column: SQLiteColumn, query: string | undefined | null): SQL | undefined {
  const tokens = normalizeSearch(query).split(' ').filter(Boolean).slice(0, 6);
  if (tokens.length === 0) return undefined;
  return and(...tokens.map((token) => sql`${column} LIKE ${`%${escapeLike(token)}%`} ESCAPE '\\'`));
}

/** Remove condições indefinidas e combina com AND (retorna undefined se não houver nenhuma). */
export function allOf(...conditions: (SQL | undefined)[]): SQL | undefined {
  const list = conditions.filter((c): c is SQL => c !== undefined);
  return list.length ? and(...list) : undefined;
}

export interface PageResult<T> {
  rows: T[];
  total: number;
}

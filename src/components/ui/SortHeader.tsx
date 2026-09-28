import Link from 'next/link';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { buildHref, type SearchParams, type SortDir } from '@/lib/query';
import { cn } from '@/lib/cn';

/** Cabeçalho de coluna ordenável: clicar alterna entre crescente e decrescente. */
export function SortHeader({
  label,
  sortKey,
  current,
  basePath,
  params,
  numeric,
  className,
}: {
  label: string;
  sortKey: string;
  current: { key: string; dir: SortDir };
  basePath: string;
  params: SearchParams;
  numeric?: boolean;
  className?: string;
}) {
  const active = current.key === sortKey;
  const nextDir: SortDir = active && current.dir === 'asc' ? 'desc' : 'asc';
  const Icon = !active ? ChevronsUpDown : current.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th
      className={cn('sortable', numeric && 'num', className)}
      aria-sort={active ? (current.dir === 'asc' ? 'ascending' : 'descending') : undefined}
      scope="col"
    >
      <Link href={buildHref(basePath, params, { ordem: sortKey, dir: nextDir, pagina: null })} scroll={false}>
        {label}
        <Icon size={13} aria-hidden="true" style={{ opacity: active ? 1 : 0.45 }} />
      </Link>
    </th>
  );
}

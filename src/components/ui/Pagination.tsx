import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { buildHref, DEFAULT_PAGE_SIZE, totalPages, type SearchParams } from '@/lib/query';
import { formatInt } from '@/lib/money';

export function Pagination({
  page,
  total,
  basePath,
  params,
  pageSize = DEFAULT_PAGE_SIZE,
  noun = 'registros',
}: {
  page: number;
  total: number;
  basePath: string;
  params: SearchParams;
  pageSize?: number;
  noun?: string;
}) {
  const pages = totalPages(total, pageSize);
  const current = Math.min(page, pages);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(total, current * pageSize);

  const numbers: (number | 'gap')[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - current) <= 1) numbers.push(p);
    else if (numbers[numbers.length - 1] !== 'gap') numbers.push('gap');
  }

  const href = (p: number) => buildHref(basePath, params, { pagina: p === 1 ? null : p });

  return (
    <div className="pagination">
      <span>
        {total === 0 ? `Nenhum ${noun.replace(/s$/, '')} encontrado` : `Mostrando ${formatInt(from)}–${formatInt(to)} de ${formatInt(total)} ${noun}`}
      </span>
      {pages > 1 ? (
        <nav className="pagination__pages" aria-label="Paginação">
          <Link
            className="pagination__link"
            href={href(Math.max(1, current - 1))}
            aria-disabled={current === 1}
            aria-label="Página anterior"
            scroll={false}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </Link>
          {numbers.map((n, i) =>
            n === 'gap' ? (
              <span key={`gap-${i}`} className="pagination__link" aria-hidden="true">
                …
              </span>
            ) : (
              <Link
                key={n}
                className="pagination__link"
                href={href(n)}
                aria-current={n === current ? 'page' : undefined}
                scroll={false}
              >
                {n}
              </Link>
            ),
          )}
          <Link
            className="pagination__link"
            href={href(Math.min(pages, current + 1))}
            aria-disabled={current === pages}
            aria-label="Próxima página"
            scroll={false}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        </nav>
      ) : null}
    </div>
  );
}

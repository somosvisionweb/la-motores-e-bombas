'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileDown } from 'lucide-react';
import { PrintButton } from '@/components/ui/Interactions';

/** Barra da página de impressão (não aparece no papel). */
export function DocToolbar({ title, backHref, pdfHref, autoPrint }: { title: string; backHref: string; pdfHref?: string; autoPrint?: boolean }) {
  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 600);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  return (
    <div className="doc-toolbar no-print">
      <Link href={backHref} className="btn btn--sm">
        <ArrowLeft aria-hidden="true" /> Voltar
      </Link>
      <span className="doc-toolbar__title">{title}</span>
      {pdfHref ? (
        <a href={pdfHref} className="btn btn--sm">
          <FileDown aria-hidden="true" /> Baixar PDF
        </a>
      ) : null}
      <PrintButton label="Imprimir (A4)" />
      <p className="doc-toolbar__hint">
        Dica: na janela de impressão, escolha “Tamanho: A4”, “Margens: Nenhuma” e desmarque “Cabeçalhos e rodapés” para o resultado ideal.
      </p>
    </div>
  );
}

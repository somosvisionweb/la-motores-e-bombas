'use client';

import { RotateCcw } from 'lucide-react';

/** Erro inesperado em qualquer página: mensagem amigável (o detalhe técnico fica só no servidor). */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="status-page" role="alert">
      <div>
        <p className="eyebrow">Algo deu errado</p>
        <h1>Não foi possível carregar a página</h1>
        <p>Tente novamente em instantes. Se o problema continuar, fale com a gente pelo WhatsApp.</p>
        {error.digest ? <p className="status-code">Código: {error.digest}</p> : null}
        <div className="status-actions">
          <button type="button" className="btn btn--primary btn--lg" onClick={reset}>
            <RotateCcw aria-hidden="true" /> Tentar novamente
          </button>
        </div>
      </div>
    </main>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata: Metadata = { title: 'Página não encontrada', robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <main className="status-page">
      <div>
        <p className="eyebrow">Erro 404</p>
        <h1>Página não encontrada</h1>
        <p>O endereço que você acessou não existe ou foi movido.</p>
        <div className="status-actions">
          <Link href="/" className="btn btn--primary btn--lg">
            <ArrowLeft aria-hidden="true" /> Voltar ao início
          </Link>
        </div>
      </div>
    </main>
  );
}

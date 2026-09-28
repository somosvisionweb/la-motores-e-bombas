import type { Metadata } from 'next';
import '@/styles/print.css';
import { ToastProvider } from '@/components/ui/Toast';

export const metadata: Metadata = {
  title: 'Impressão',
  robots: { index: false, follow: false },
};

/** Documentos para impressão: sem menu lateral, apenas a barra de ações e as folhas A4. */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="doc-page">{children}</div>
    </ToastProvider>
  );
}

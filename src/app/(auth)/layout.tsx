import type { Metadata } from 'next';
import '@/styles/app.css';
import { ToastProvider } from '@/components/ui/Toast';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

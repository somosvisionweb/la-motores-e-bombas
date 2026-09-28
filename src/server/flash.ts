import 'server-only';
import { cookies } from 'next/headers';

export type FlashKind = 'success' | 'error' | 'info';

/**
 * Mensagem de feedback exibida (como toast) na próxima página, mesmo após redirect.
 * Cookie curto (30s), lido e apagado pelo <FlashToaster /> no navegador.
 */
export async function setFlash(kind: FlashKind, message: string): Promise<void> {
  (await cookies()).set('la_flash', encodeURIComponent(JSON.stringify({ kind, message })), {
    path: '/',
    maxAge: 30,
    sameSite: 'lax',
    httpOnly: false,
  });
}

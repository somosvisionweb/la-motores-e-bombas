import { NextResponse } from 'next/server';
import { PermissionError } from '../auth/errors';
import { requireActionPermission } from '../auth/session';
import type { PermissionKey, SessionUser } from '../auth/types';

/** Resposta HTTP de um PDF (inline no navegador ou como download). */
export function pdfResponse(buffer: Buffer, filename: string, download: boolean): Response {
  const safeName = filename.replace(/[^A-Za-z0-9._-]/g, '_');
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(buffer.length),
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${safeName}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex',
    },
  });
}

/** Autoriza uma rota de API; retorna o usuário ou uma resposta 401/403 pronta. */
export async function guardApi(...permissions: PermissionKey[]): Promise<{ user: SessionUser } | { response: Response }> {
  try {
    return { user: await requireActionPermission(...permissions) };
  } catch (error) {
    if (error instanceof PermissionError) {
      const unauthenticated = /sessão expirou/i.test(error.message);
      return { response: NextResponse.json({ error: error.message }, { status: unauthenticated ? 401 : 403 }) };
    }
    throw error;
  }
}

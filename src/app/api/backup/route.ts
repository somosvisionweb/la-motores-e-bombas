import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { guardApi } from '@/server/documents/http';
import { getDatabaseUrl, getRawClient } from '@/server/db/client';
import { toActor } from '@/server/auth/types';
import { audit } from '@/server/services/audit';

/** Backup consistente do banco (VACUUM INTO) — apenas para administradores; o arquivo temporário é apagado após o envio. */
export async function GET() {
  const guard = await guardApi('settings.manage');
  if ('response' in guard) return guard.response;

  if (!getDatabaseUrl().startsWith('file:')) {
    return NextResponse.json({ error: 'Banco na nuvem: use os backups do provedor.' }, { status: 400 });
  }

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const temp = path.join(os.tmpdir(), `la-motores-${stamp}-${process.pid}.db`);
  try {
    await getRawClient().execute(`VACUUM INTO '${temp.replace(/'/g, "''")}'`);
    const data = fs.readFileSync(temp);
    await audit({ actor: toActor(guard.user), action: 'BACKUP_DOWNLOAD', summary: 'Backup do banco baixado' });
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="la-motores-${stamp}.db"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } finally {
    fs.rmSync(temp, { force: true });
  }
}

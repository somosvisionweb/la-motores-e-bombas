import './_env';
import fs from 'node:fs';
import path from 'node:path';
import { closeDb, getDatabaseUrl, getRawClient } from '../src/server/db/client';

/** Cópia consistente do banco (VACUUM INTO) — pode ser executada com o sistema em uso. */
async function main() {
  const url = getDatabaseUrl();
  if (!url.startsWith('file:')) {
    console.log('Banco remoto (Turso): use os backups/snapshots do próprio provedor.');
    return;
  }
  const dir = path.resolve(process.env.BACKUP_DIR || 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const target = path.join(dir, `la-motores-${stamp}.db`);
  await getRawClient().execute(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  console.log(`✔ Backup criado: ${target}`);
}

main()
  .catch((error) => {
    console.error('✖ Falha ao criar backup:', error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());

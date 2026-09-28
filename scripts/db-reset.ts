import './_env';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDatabaseUrl } from '../src/server/db/client';

/**
 * Recria o banco do zero (APAGA TODOS OS DADOS).
 * Uso: npm run db:reset -- --yes [--demo]
 * Bloqueado em produção (NODE_ENV=production) a menos que --force seja informado.
 */
function main() {
  const args = process.argv.slice(2);
  const url = getDatabaseUrl();

  if (!args.includes('--yes')) {
    console.error('Este comando APAGA o banco de dados. Confirme com: npm run db:reset -- --yes');
    process.exitCode = 1;
    return;
  }
  if (process.env.NODE_ENV === 'production' && !args.includes('--force')) {
    console.error('Bloqueado em produção. Use --force se tiver certeza absoluta (faça backup antes).');
    process.exitCode = 1;
    return;
  }
  if (!url.startsWith('file:')) {
    console.error('db:reset só funciona com banco local (file:).');
    process.exitCode = 1;
    return;
  }

  const file = path.resolve(url.slice('file:'.length));
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    if (fs.existsSync(file + suffix)) fs.rmSync(file + suffix);
  }
  console.log(`✔ Banco removido: ${file}`);

  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const steps = ['db:migrate', 'db:seed', ...(args.includes('--demo') ? ['db:demo'] : [])];
  for (const step of steps) {
    const result = spawnSync(npm, ['run', step], { stdio: 'inherit', shell: process.platform === 'win32' });
    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      return;
    }
  }
}

main();

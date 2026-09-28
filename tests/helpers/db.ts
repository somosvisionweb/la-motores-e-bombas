import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { closeDb, getDb } from '@/server/db/client';
import { runMigrations } from '@/server/db/migrate';
import { seedOfficialData } from '@/server/db/seed/official';
import { users } from '@/server/db/schema';
import type { Actor } from '@/server/auth/types';

/** Cria um banco SQLite temporário, aplica as migrações e o seed oficial. */
export async function setupTestDb(name: string): Promise<{ actor: Actor; file: string }> {
  const dir = path.resolve('.tmp');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.db`);
  closeDb();
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    if (fs.existsSync(file + suffix)) fs.rmSync(file + suffix);
  }
  process.env.DATABASE_URL = `file:${file.replace(/\\/g, '/')}`;
  await runMigrations();
  await seedOfficialData();
  const [admin] = await getDb().select().from(users).where(eq(users.username, 'ewerton')).limit(1);
  return { actor: { id: admin!.id, name: admin!.name, ip: '127.0.0.1' }, file };
}

export function teardownTestDb(): void {
  closeDb();
}

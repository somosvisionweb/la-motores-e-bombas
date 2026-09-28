import path from 'node:path';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { getDb } from './client';

/** Aplica as migrações pendentes (pasta `drizzle/`). Idempotente. */
export async function runMigrations(): Promise<void> {
  await migrate(getDb(), { migrationsFolder: path.join(process.cwd(), 'drizzle') });
}

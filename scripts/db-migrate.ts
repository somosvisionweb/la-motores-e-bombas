import './_env';
import { closeDb, getDatabaseUrl } from '../src/server/db/client';
import { runMigrations } from '../src/server/db/migrate';

async function main() {
  await runMigrations();
  console.log(`✔ Migrações aplicadas em ${getDatabaseUrl()}`);
}

main()
  .catch((error) => {
    console.error('✖ Falha ao aplicar migrações:', error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());

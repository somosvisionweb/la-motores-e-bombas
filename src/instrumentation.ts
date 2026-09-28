/** Executa uma vez ao iniciar o servidor: aplica migrações pendentes do banco (desative com AUTO_MIGRATE=false). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.AUTO_MIGRATE === 'false') return;
  try {
    const { runMigrations } = await import('./server/db/migrate');
    await runMigrations();
  } catch (error) {
    console.error('[db] Falha ao aplicar migrações automáticas:', error);
  }
}

import './_env';
import { eq } from 'drizzle-orm';
import { generateTemporaryPassword, hashPassword } from '../src/server/auth/password';
import { closeDb, getDb, runWrite } from '../src/server/db/client';
import { sessions, users } from '../src/server/db/schema';

/** Uso: npm run user:reset-password -- <usuario>  → gera nova senha temporária e encerra as sessões. */
async function main() {
  const username = process.argv[2]?.trim().toLowerCase();
  if (!username) {
    console.error('Informe o usuário: npm run user:reset-password -- ewerton');
    process.exitCode = 1;
    return;
  }
  const [user] = await getDb().select().from(users).where(eq(users.username, username)).limit(1);
  if (!user) {
    console.error(`Usuário "${username}" não encontrado.`);
    process.exitCode = 1;
    return;
  }
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  await runWrite(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash, mustChangePassword: true, isActive: true, passwordChangedAt: new Date() })
      .where(eq(users.id, user.id));
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
  });
  console.log(`✔ Senha de "${username}" redefinida. Senha temporária (troca obrigatória no próximo acesso): ${temporaryPassword}`);
}

main()
  .catch((error) => {
    console.error('✖ Falha ao redefinir senha:', error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());

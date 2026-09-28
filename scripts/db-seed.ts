import './_env';
import { closeDb } from '../src/server/db/client';
import { seedOfficialData } from '../src/server/db/seed/official';

async function main() {
  const { createdUsers } = await seedOfficialData();
  console.log('✔ Dados oficiais da LA Motores e Bombas garantidos (empresa, perfis, termos, serviços, produtos).');

  if (createdUsers.length === 0) {
    console.log('  Usuários iniciais já existem — nada a criar.');
    return;
  }

  const line = '─'.repeat(64);
  console.log(`\n${line}`);
  console.log(' USUÁRIOS INICIAIS — anote as senhas TEMPORÁRIAS (exibidas só agora)');
  console.log(' A troca de senha é obrigatória no primeiro acesso.');
  console.log(line);
  for (const user of createdUsers) {
    console.log(` ${user.name.padEnd(16)} ${user.roleName.padEnd(22)} usuário: ${user.username.padEnd(10)} senha: ${user.temporaryPassword}`);
  }
  console.log(`${line}\n`);
}

main()
  .catch((error) => {
    console.error('✖ Falha ao semear dados oficiais:', error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());

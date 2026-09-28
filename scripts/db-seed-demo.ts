import './_env';
import { closeDb } from '../src/server/db/client';
import { seedDemoData } from '../src/server/db/seed/demo';

async function main() {
  const result = await seedDemoData();
  console.log('✔ Dados de DEMONSTRAÇÃO criados (fictícios, marcados como demo):');
  console.log(`  ${result.customers} clientes · ${result.orders} ordens · ${result.sales} vendas · ${result.payments} pagamentos · ${result.expenses} custos · ${result.storeOrders} pedidos da loja`);
  console.log('  Loja virtual: preços FICTÍCIOS de demonstração aplicados aos produtos (somem ao remover os dados de demonstração).');
  console.log('  Para removê-los: npm run db:demo:clear  (ou Configurações → Dados de demonstração)');
}

main()
  .catch((error) => {
    console.error('✖ Falha ao criar dados de demonstração:', error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());

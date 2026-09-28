import './_env';
import { closeDb } from '../src/server/db/client';
import { clearDemoData } from '../src/server/services/demo';

async function main() {
  const removed = await clearDemoData();
  console.log('✔ Dados de demonstração removidos:');
  console.log(`  ${removed.customers} clientes · ${removed.orders} ordens · ${removed.sales} vendas · ${removed.payments} pagamentos · ${removed.expenses} custos · ${removed.storeOrders} pedidos da loja · ${removed.demoPrices} preços de demonstração`);
  if (removed.keptCustomers > 0) console.log(`  ${removed.keptCustomers} cliente(s) de demonstração mantido(s) porque possuem ordens reais.`);
}

main()
  .catch((error) => {
    console.error('✖ Falha ao remover dados de demonstração:', error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());

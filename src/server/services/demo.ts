import { sql } from 'drizzle-orm';
import { getDb, runWrite } from '../db/client';

/** Existem registros de DEMONSTRAÇÃO no banco? (exibe o aviso permanente no sistema) */
export async function hasDemoData(): Promise<boolean> {
  const rows = await getDb().all<{ found: number }>(sql`
    SELECT 1 AS found WHERE EXISTS (SELECT 1 FROM customers WHERE is_demo = 1)
       OR EXISTS (SELECT 1 FROM service_orders WHERE is_demo = 1)
       OR EXISTS (SELECT 1 FROM payments WHERE is_demo = 1)
       OR EXISTS (SELECT 1 FROM expenses WHERE is_demo = 1)
       OR EXISTS (SELECT 1 FROM sales WHERE is_demo = 1)
       OR EXISTS (SELECT 1 FROM store_orders WHERE is_demo = 1)
       OR EXISTS (SELECT 1 FROM products WHERE demo_price_cents IS NOT NULL)
  `);
  return rows.length > 0;
}

export interface DemoCounts {
  customers: number;
  orders: number;
  sales: number;
  payments: number;
  expenses: number;
  storeOrders: number;
  /** Produtos com preço de demonstração (fictício) na loja virtual. */
  demoPrices: number;
}

export async function countDemoData(): Promise<DemoCounts> {
  const [row] = await getDb().all<Record<keyof DemoCounts, number>>(sql`
    SELECT (SELECT COUNT(*) FROM customers WHERE is_demo = 1) AS customers,
           (SELECT COUNT(*) FROM service_orders WHERE is_demo = 1) AS orders,
           (SELECT COUNT(*) FROM sales WHERE is_demo = 1) AS sales,
           (SELECT COUNT(*) FROM payments WHERE is_demo = 1) AS payments,
           (SELECT COUNT(*) FROM expenses WHERE is_demo = 1) AS expenses,
           (SELECT COUNT(*) FROM store_orders WHERE is_demo = 1) AS storeOrders,
           (SELECT COUNT(*) FROM products WHERE demo_price_cents IS NOT NULL) AS demoPrices
  `);
  return {
    customers: Number(row?.customers ?? 0),
    orders: Number(row?.orders ?? 0),
    sales: Number(row?.sales ?? 0),
    payments: Number(row?.payments ?? 0),
    expenses: Number(row?.expenses ?? 0),
    storeOrders: Number(row?.storeOrders ?? 0),
    demoPrices: Number(row?.demoPrices ?? 0),
  };
}

/**
 * Remove TODOS os dados de demonstração, na ordem correta das dependências.
 * Registros reais nunca são apagados: clientes de demonstração que ganharam ordens REAIS são mantidos.
 */
export async function clearDemoData(): Promise<DemoCounts & { keptCustomers: number }> {
  const before = await countDemoData();
  let kept = 0;
  await runWrite(async (tx) => {
    // pagamentos de demonstração e quaisquer pagamentos ligados a ordens/vendas de demonstração
    await tx.run(sql`DELETE FROM payments WHERE is_demo = 1
      OR order_id IN (SELECT id FROM service_orders WHERE is_demo = 1)
      OR sale_id IN (SELECT id FROM sales WHERE is_demo = 1)`);
    // pedidos da loja de demonstração (a linha do tempo sai junto) antes das vendas que os originaram
    await tx.run(sql`DELETE FROM store_orders WHERE is_demo = 1 OR sale_id IN (SELECT id FROM sales WHERE is_demo = 1)`);
    await tx.run(sql`DELETE FROM sales WHERE is_demo = 1`);
    // preços fictícios da loja virtual
    await tx.run(sql`UPDATE products SET demo_price_cents = NULL WHERE demo_price_cents IS NOT NULL`);
    await tx.run(sql`DELETE FROM service_orders WHERE is_demo = 1`);
    await tx.run(sql`DELETE FROM expenses WHERE is_demo = 1`);
    await tx.run(sql`DELETE FROM stock_movements WHERE is_demo = 1`);
    await tx.run(sql`DELETE FROM notifications WHERE is_demo = 1`);
    await tx.run(sql`DELETE FROM customers WHERE is_demo = 1
      AND id NOT IN (SELECT customer_id FROM service_orders)
      AND id NOT IN (SELECT customer_id FROM sales WHERE customer_id IS NOT NULL)`);
    const [left] = await tx.all<{ n: number }>(sql`SELECT COUNT(*) AS n FROM customers WHERE is_demo = 1`);
    kept = Number(left?.n ?? 0);
  });
  return { ...before, keptCustomers: kept };
}

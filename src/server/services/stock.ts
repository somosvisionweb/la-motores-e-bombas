/**
 * Estoque em livro-razão: todo movimento é um lançamento em `stock_movements` e o saldo em
 * `products.stock` é atualizado na MESMA transação. Ordens de serviço e vendas usam a reconciliação
 * (`reconcileStockForRef`), que é idempotente: calcula o que deveria estar consumido e lança só a diferença.
 */
import { and, eq, sql } from 'drizzle-orm';
import type { StockReason } from '@/config/payment-methods';
import type { Tx } from '../db/client';
import { products, stockMovements } from '../db/schema';

export interface MovementInput {
  productId: number;
  delta: number;
  reason: StockReason;
  refType?: 'service_order' | 'sale' | null;
  refId?: number | null;
  note?: string | null;
  actorId?: number | null;
  isDemo?: boolean;
}

export async function recordMovement(tx: Tx, input: MovementInput): Promise<void> {
  if (input.delta === 0) return;
  await tx.insert(stockMovements).values({
    productId: input.productId,
    delta: input.delta,
    reason: input.reason,
    refType: input.refType ?? null,
    refId: input.refId ?? null,
    note: input.note ?? null,
    createdBy: input.actorId ?? null,
    isDemo: input.isDemo ?? false,
  });
  await tx
    .update(products)
    .set({ stock: sql`${products.stock} + ${input.delta}` })
    .where(eq(products.id, input.productId));
}

/**
 * Ajusta o estoque para refletir `desired` (produto → quantidade consumida) para a origem informada.
 * Ex.: OS com 2× Rolamento → consumo 2. Se depois vira 3× → lança −1. Se a OS é cancelada (desired vazio) → devolve tudo.
 */
export async function reconcileStockForRef(
  tx: Tx,
  input: {
    refType: 'service_order' | 'sale';
    refId: number;
    desired: Map<number, number>;
    reason: 'ORDER' | 'SALE';
    actorId?: number | null;
    isDemo?: boolean;
    note?: string;
  },
): Promise<void> {
  const rows = await tx
    .select({ productId: stockMovements.productId, total: sql<number>`COALESCE(SUM(${stockMovements.delta}), 0)` })
    .from(stockMovements)
    .where(and(eq(stockMovements.refType, input.refType), eq(stockMovements.refId, input.refId)))
    .groupBy(stockMovements.productId);

  const consumed = new Map<number, number>(rows.map((r) => [r.productId, -Number(r.total)]));
  const ids = new Set<number>([...consumed.keys(), ...input.desired.keys()]);

  for (const productId of ids) {
    const want = input.desired.get(productId) ?? 0;
    const have = consumed.get(productId) ?? 0;
    const diff = want - have;
    if (diff === 0) continue;
    await recordMovement(tx, {
      productId,
      delta: -diff,
      reason: diff > 0 ? input.reason : 'RETURN',
      refType: input.refType,
      refId: input.refId,
      note: input.note ?? (want === 0 ? 'Devolução ao estoque' : undefined),
      actorId: input.actorId,
      isDemo: input.isDemo,
    });
  }
}

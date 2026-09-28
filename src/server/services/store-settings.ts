import { eq } from 'drizzle-orm';
import { STORE_DEFAULTS, type PixKeyType } from '@/config/store';
import type { Actor } from '../auth/types';
import { getDb, runWrite, type DbOrTx } from '../db/client';
import { storeSettings } from '../db/schema';
import { audit } from './audit';

/** Configurações da loja virtual (linha única). Sem a linha, valem os padrões de `STORE_DEFAULTS`. */
export interface StoreConfig {
  enabled: boolean;
  pixKey: string | null;
  pixKeyType: PixKeyType | null;
  deliveryEnabled: boolean;
  deliveryFeeCents: number;
  freeDeliveryMinCents: number | null;
  deliveryNote: string | null;
  pickupNote: string | null;
  minOrderCents: number;
  holdHours: number;
  policyText: string | null;
}

export async function getStoreSettings(db: DbOrTx = getDb()): Promise<StoreConfig> {
  const [row] = await db.select().from(storeSettings).where(eq(storeSettings.id, 1)).limit(1);
  if (!row) return { ...STORE_DEFAULTS };
  return {
    enabled: row.enabled,
    pixKey: row.pixKey,
    pixKeyType: row.pixKeyType,
    deliveryEnabled: row.deliveryEnabled,
    deliveryFeeCents: row.deliveryFeeCents,
    freeDeliveryMinCents: row.freeDeliveryMinCents,
    deliveryNote: row.deliveryNote,
    pickupNote: row.pickupNote,
    minOrderCents: row.minOrderCents,
    holdHours: row.holdHours,
    policyText: row.policyText,
  };
}

/** A loja só oferece PIX quando a empresa cadastrou a chave (ou em pedidos de demonstração). */
export function storeAcceptsPix(config: Pick<StoreConfig, 'pixKey'>): boolean {
  return Boolean(config.pixKey);
}

export async function updateStoreSettings(input: StoreConfig, actor: Actor): Promise<void> {
  await runWrite(async (tx) => {
    const values = { ...input, updatedBy: actor.id };
    await tx
      .insert(storeSettings)
      .values({ id: 1, ...values })
      .onConflictDoUpdate({ target: storeSettings.id, set: { ...values, updatedAt: new Date() } });
    await audit({
      actor,
      action: 'STORE_SETTINGS_UPDATE',
      entityType: 'store_settings',
      entityId: 1,
      summary: `Loja virtual ${input.enabled ? 'aberta' : 'fechada'} · PIX ${input.pixKey ? 'configurado' : 'não configurado'} · entrega ${input.deliveryEnabled ? 'ativada' : 'desativada'}`,
    });
  });
}

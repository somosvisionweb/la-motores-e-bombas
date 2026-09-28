/**
 * Notificações internas.
 *  - Persistidas (eventos): nova OS, OS aguardando aprovação, serviço pronto.
 *  - Calculadas (alertas): estoque baixo, pagamento pendente, OS com prazo próximo/atrasado, próximo serviço.
 *    Os alertas somem sozinhos quando a condição deixa de existir.
 */
import { and, desc, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm';
import { IN_PROGRESS_ORDER_STATUSES } from '@/config/order-status';
import { addDaysISO, dateOnlyInTimezone } from '@/lib/dates';
import { formatOrderCode } from '@/lib/codes';
import type { Actor, SessionUser } from '../auth/types';
import { getDb, runWrite } from '../db/client';
import { customers, notificationReads, notifications, serviceOrders, storeOrders } from '../db/schema';
import { listLowStockProducts } from './products';
import { orderPaidSql } from './payments';
import { pendingRequiredSteps } from './publication';

type NotificationType = (typeof notifications.$inferInsert)['type'];

export async function createNotification(input: {
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  permission?: string | null;
  actor?: Actor | null;
  isDemo?: boolean;
  createdAt?: Date;
}): Promise<void> {
  await runWrite(async (tx) => {
    const [created] = await tx
      .insert(notifications)
      .values({
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
        permission: input.permission ?? null,
        createdBy: input.actor?.id ?? null,
        isDemo: input.isDemo ?? false,
        ...(input.createdAt ? { createdAt: input.createdAt } : {}),
      })
      .returning({ id: notifications.id });
    // Quem gerou o evento não precisa ser avisado dele.
    if (input.actor?.id) await tx.insert(notificationReads).values({ notificationId: created!.id, userId: input.actor.id });
  });
}

export interface NotificationItem {
  id: number;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  createdAt: Date;
  read: boolean;
}

const RETENTION_DAYS = 30;

function visibleTo(user: Pick<SessionUser, 'permissions'>) {
  return user.permissions.length
    ? or(isNull(notifications.permission), inArray(notifications.permission, user.permissions))
    : isNull(notifications.permission);
}

export async function listNotifications(user: Pick<SessionUser, 'id' | 'permissions'>, opts: { limit?: number; unreadOnly?: boolean } = {}): Promise<NotificationItem[]> {
  const since = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
  const rows = await getDb()
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      link: notifications.link,
      createdAt: notifications.createdAt,
      readAt: notificationReads.readAt,
    })
    .from(notifications)
    .leftJoin(notificationReads, and(eq(notificationReads.notificationId, notifications.id), eq(notificationReads.userId, user.id)))
    .where(and(gte(notifications.createdAt, since), visibleTo(user), opts.unreadOnly ? isNull(notificationReads.readAt) : undefined))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(opts.limit ?? 30);
  return rows.map(({ readAt, ...rest }) => ({ ...rest, read: readAt !== null }));
}

export async function countUnread(user: Pick<SessionUser, 'id' | 'permissions'>): Promise<number> {
  const since = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)` })
    .from(notifications)
    .leftJoin(notificationReads, and(eq(notificationReads.notificationId, notifications.id), eq(notificationReads.userId, user.id)))
    .where(and(gte(notifications.createdAt, since), visibleTo(user), isNull(notificationReads.readAt)));
  return Number(row?.n ?? 0);
}

export async function markAllRead(user: Pick<SessionUser, 'id' | 'permissions'>): Promise<void> {
  const unread = await listNotifications(user, { unreadOnly: true, limit: 500 });
  if (unread.length === 0) return;
  await runWrite(async (tx) => {
    for (const n of unread) await tx.insert(notificationReads).values({ notificationId: n.id, userId: user.id }).onConflictDoNothing();
  });
}

export async function markRead(user: Pick<SessionUser, 'id'>, notificationId: number): Promise<void> {
  await runWrite(async (tx) => {
    await tx.insert(notificationReads).values({ notificationId, userId: user.id }).onConflictDoNothing();
  });
}

// ---------------------------------------------------------------------------
// Alertas calculados
// ---------------------------------------------------------------------------

export interface SystemAlert {
  key: string;
  tone: 'amber' | 'red' | 'blue' | 'violet';
  title: string;
  body: string;
  link: string;
  count: number;
}

export async function getSystemAlerts(user: Pick<SessionUser, 'permissions'>, timezone: string): Promise<SystemAlert[]> {
  const db = getDb();
  const can = (p: string) => user.permissions.includes(p);
  const today = dateOnlyInTimezone(new Date(), timezone);
  const alerts: SystemAlert[] = [];

  if (can('products.view')) {
    const low = await listLowStockProducts(50);
    if (low.length) {
      alerts.push({
        key: 'low-stock',
        tone: 'amber',
        title: `Estoque baixo em ${low.length} ${low.length === 1 ? 'produto' : 'produtos'}`,
        body: low.slice(0, 3).map((p) => `${p.name} (${p.stock}/${p.minStock})`).join(', ') + (low.length > 3 ? '…' : ''),
        link: '/sistema/produtos?estoque=baixo',
        count: low.length,
      });
    }
  }

  if (can('orders.view')) {
    const inProgress = IN_PROGRESS_ORDER_STATUSES as string[];
    const overdue = await db
      .select({ number: serviceOrders.number, customer: customers.name })
      .from(serviceOrders)
      .innerJoin(customers, eq(customers.id, serviceOrders.customerId))
      .where(and(inArray(serviceOrders.status, inProgress as never), sql`${serviceOrders.expectedDeliveryDate} < ${today}`))
      .orderBy(serviceOrders.expectedDeliveryDate)
      .limit(50);
    if (overdue.length) {
      alerts.push({
        key: 'overdue',
        tone: 'red',
        title: `${overdue.length} ${overdue.length === 1 ? 'OS com prazo vencido' : 'OS com prazo vencido'}`,
        body: overdue.slice(0, 3).map((o) => `${formatOrderCode(o.number)} · ${o.customer}`).join(', ') + (overdue.length > 3 ? '…' : ''),
        link: '/sistema/ordens?prazo=atrasadas',
        count: overdue.length,
      });
    }

    const dueSoon = await db
      .select({ number: serviceOrders.number, customer: customers.name, due: serviceOrders.expectedDeliveryDate })
      .from(serviceOrders)
      .innerJoin(customers, eq(customers.id, serviceOrders.customerId))
      .where(
        and(
          inArray(serviceOrders.status, inProgress as never),
          sql`${serviceOrders.expectedDeliveryDate} >= ${today}`,
          sql`${serviceOrders.expectedDeliveryDate} <= ${addDaysISO(today, 2)}`,
        ),
      )
      .orderBy(serviceOrders.expectedDeliveryDate)
      .limit(50);
    if (dueSoon.length) {
      alerts.push({
        key: 'due-soon',
        tone: 'amber',
        title: `${dueSoon.length} ${dueSoon.length === 1 ? 'OS próxima' : 'OS próximas'} da data prevista`,
        body: dueSoon.slice(0, 3).map((o) => `${formatOrderCode(o.number)} · ${o.customer}`).join(', ') + (dueSoon.length > 3 ? '…' : ''),
        link: '/sistema/ordens?prazo=proximas',
        count: dueSoon.length,
      });
    }

    const [awaiting] = await db
      .select({ n: sql<number>`count(*)` })
      .from(serviceOrders)
      .where(eq(serviceOrders.status, 'AGUARDANDO_APROVACAO'));
    if (Number(awaiting?.n)) {
      alerts.push({
        key: 'awaiting-approval',
        tone: 'violet',
        title: `${awaiting!.n} ${Number(awaiting!.n) === 1 ? 'orçamento aguardando' : 'orçamentos aguardando'} aprovação`,
        body: 'Entre em contato com o cliente para confirmar.',
        link: '/sistema/ordens?status=AGUARDANDO_APROVACAO',
        count: Number(awaiting!.n),
      });
    }

    const nextService = await db
      .select({ number: serviceOrders.number, customer: customers.name })
      .from(serviceOrders)
      .innerJoin(customers, eq(customers.id, serviceOrders.customerId))
      .where(and(sql`${serviceOrders.nextServiceDate} >= ${today}`, sql`${serviceOrders.nextServiceDate} <= ${addDaysISO(today, 7)}`, sql`${serviceOrders.status} <> 'CANCELADO'`))
      .limit(50);
    if (nextService.length) {
      alerts.push({
        key: 'next-service',
        tone: 'blue',
        title: `${nextService.length} ${nextService.length === 1 ? 'retorno previsto' : 'retornos previstos'} nos próximos 7 dias`,
        body: nextService.slice(0, 3).map((o) => o.customer).join(', ') + (nextService.length > 3 ? '…' : ''),
        link: '/sistema/ordens?prazo=retorno',
        count: nextService.length,
      });
    }
  }

  if (can('settings.manage')) {
    const pending = await pendingRequiredSteps();
    if (pending.length) {
      alerts.push({
        key: 'publication',
        tone: 'blue',
        title: `Faltam ${pending.length} ${pending.length === 1 ? 'passo' : 'passos'} para publicar o site`,
        body: pending.slice(0, 3).map((step) => step.title).join(', ') + (pending.length > 3 ? '…' : ''),
        link: '/sistema/configuracoes/publicacao',
        count: pending.length,
      });
    }
  }

  if (can('store.view')) {
    const [fresh] = await db.select({ n: sql<number>`count(*)` }).from(storeOrders).where(eq(storeOrders.status, 'RECEIVED'));
    const total = Number(fresh?.n ?? 0);
    if (total) {
      alerts.push({
        key: 'store-new',
        tone: 'blue',
        title: `${total} ${total === 1 ? 'pedido novo' : 'pedidos novos'} na loja online`,
        body: 'Confirme o pedido e o pagamento para o cliente acompanhar.',
        link: '/sistema/loja?status=RECEIVED',
        count: total,
      });
    }
  }

  if (can('payments.view')) {
    const pending = await db
      .select({ number: serviceOrders.number, customer: customers.name, balance: sql<number>`${serviceOrders.totalCents} - ${orderPaidSql}` })
      .from(serviceOrders)
      .innerJoin(customers, eq(customers.id, serviceOrders.customerId))
      .where(and(inArray(serviceOrders.status, ['PRONTO', 'ENTREGUE']), sql`${serviceOrders.totalCents} > ${orderPaidSql}`))
      .limit(100);
    if (pending.length) {
      alerts.push({
        key: 'payment-pending',
        tone: 'red',
        title: `${pending.length} ${pending.length === 1 ? 'pagamento pendente' : 'pagamentos pendentes'}`,
        body: pending.slice(0, 3).map((o) => `${formatOrderCode(o.number)} · ${o.customer}`).join(', ') + (pending.length > 3 ? '…' : ''),
        link: '/sistema/ordens?pagamento=pendente',
        count: pending.length,
      });
    }
  }

  return alerts;
}

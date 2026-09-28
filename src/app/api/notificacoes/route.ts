import { NextResponse } from 'next/server';
import { getSessionUser } from '@/server/auth/session';
import { countUnread, getSystemAlerts, listNotifications } from '@/server/services/notifications';
import { getCompanySettings } from '@/server/services/settings';

/** Dados do sino: notificações recentes, não lidas e alertas calculados. */
export async function GET() {
  const user = await getSessionUser();
  if (!user || user.mustChangePassword) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  const company = await getCompanySettings();
  const [items, unread, alerts] = await Promise.all([listNotifications(user, { limit: 8 }), countUnread(user), getSystemAlerts(user, company.timezone)]);
  return NextResponse.json(
    {
      unread,
      alertCount: alerts.reduce((sum, a) => sum + a.count, 0),
      items: items.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, link: n.link, read: n.read, createdAt: n.createdAt.toISOString() })),
      alerts: alerts.map((a) => ({ key: a.key, tone: a.tone, title: a.title, body: a.body, link: a.link })),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

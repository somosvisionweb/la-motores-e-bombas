import Link from 'next/link';
import { AlertTriangle, Bell, CheckCheck } from 'lucide-react';
import { markAllNotificationsReadAction } from '@/actions/notifications';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatDateTimeBR } from '@/lib/dates';
import { requireUser } from '@/server/auth/session';
import { getSystemAlerts, listNotifications } from '@/server/services/notifications';
import { getCompanySettings } from '@/server/services/settings';

export const metadata = { title: 'Notificações' };

export default async function NotificationsPage() {
  const user = await requireUser();
  const company = await getCompanySettings();
  const [items, alerts] = await Promise.all([listNotifications(user, { limit: 100 }), getSystemAlerts(user, company.timezone)]);
  const unread = items.filter((n) => !n.read).length;

  async function markAll() {
    'use server';
    await markAllNotificationsReadAction();
  }

  return (
    <>
      <PageHeader
        title="Notificações"
        subtitle="Avisos do sistema dos últimos 30 dias e alertas que pedem atenção."
        actions={
          unread > 0 ? (
            <form action={markAll}>
              <button type="submit" className="btn">
                <CheckCheck aria-hidden="true" /> Marcar todas como lidas
              </button>
            </form>
          ) : null
        }
      />
      <div className="stack" style={{ ['--gap' as string]: '20px' }}>
        {alerts.length > 0 ? (
          <Card>
            <CardHeader title="Alertas ativos" subtitle="Somem sozinhos quando a situação é resolvida." icon={<AlertTriangle size={20} color="var(--color-warning)" aria-hidden="true" />} />
            <CardBody flush>
              <ul className="alert-list">
                {alerts.map((a) => (
                  <li key={a.key}>
                    <Link href={a.link} className={`alert-item alert-item--${a.tone}`}>
                      <span className="alert-item__count">{a.count}</span>
                      <span className="grow">
                        <strong>{a.title}</strong>
                        <span className="alert-item__body">{a.body}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}

        <Card>
          <CardHeader title="Histórico" icon={<Bell size={20} color="var(--navy-500)" aria-hidden="true" />} />
          {items.length === 0 ? (
            <EmptyState icon={<Bell size={24} aria-hidden="true" />} title="Nenhuma notificação">
              Novas ordens, orçamentos aguardando aprovação e serviços prontos aparecerão aqui.
            </EmptyState>
          ) : (
            <CardBody flush>
              <ul>
                {items.map((n) => (
                  <li key={n.id}>
                    <Link href={n.link ?? '#'} className={n.read ? 'notif-item' : 'notif-item notif-item--unread'}>
                      <span className="grow">
                        <span className="notif-item__title" style={{ display: 'block' }}>
                          {n.title} {!n.read ? <Badge tone="green">Nova</Badge> : null}
                        </span>
                        {n.body ? (
                          <span className="notif-item__body" style={{ display: 'block' }}>
                            {n.body}
                          </span>
                        ) : null}
                      </span>
                      <span className="notif-item__time">{formatDateTimeBR(n.createdAt, company.timezone)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardBody>
          )}
        </Card>
      </div>
    </>
  );
}

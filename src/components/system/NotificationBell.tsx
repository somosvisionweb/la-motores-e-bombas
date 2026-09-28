'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Bell, CheckCheck, ClipboardCheck, ClipboardList, Hourglass, Info, ShoppingBag } from 'lucide-react';
import { markAllNotificationsReadAction, markNotificationReadAction } from '@/actions/notifications';
import { Menu } from '@/components/ui/Menu';

interface Item {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}
interface AlertItem {
  key: string;
  tone: 'amber' | 'red' | 'blue' | 'violet';
  title: string;
  body: string;
  link: string;
}
interface Payload {
  unread: number;
  alertCount: number;
  items: Item[];
  alerts: AlertItem[];
}

const TYPE_ICON: Record<string, typeof Bell> = { ORDER_CREATED: ClipboardList, ORDER_READY: ClipboardCheck, ORDER_AWAITING_APPROVAL: Hourglass, STORE_ORDER: ShoppingBag, INFO: Info };

function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.round(hours / 24)} d`;
}

export function NotificationBell() {
  const [data, setData] = useState<Payload | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/notificacoes', { cache: 'no-store' });
      if (response.ok) setData((await response.json()) as Payload);
    } catch {
      /* rede indisponível: mantém o último estado */
    }
  }, []);

  useEffect(() => {
    const first = window.setTimeout(load, 0);
    const timer = window.setInterval(load, 60_000);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  const badge = (data?.unread ?? 0) + (data?.alertCount ?? 0);

  return (
    <div className="bell" onClickCapture={() => void load()}>
      <Menu
        label={badge > 0 ? `Notificações (${badge} pendentes)` : 'Notificações'}
        triggerClassName="btn--ghost btn--icon"
        panelClassName="notif-panel"
        trigger={
          <>
            <Bell aria-hidden="true" />
            {badge > 0 ? <span className="bell__count">{badge > 99 ? '99+' : badge}</span> : null}
          </>
        }
      >
        <div className="notif-panel__head">
          <span>Notificações</span>
          {data && data.unread > 0 ? (
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={async () => {
                await markAllNotificationsReadAction();
                await load();
              }}
            >
              <CheckCheck aria-hidden="true" /> Marcar como lidas
            </button>
          ) : null}
        </div>

        {data?.alerts.map((a) => (
          <Link key={a.key} href={a.link} className="notif-item" style={{ ['--tone-bg' as string]: `var(--tone-${a.tone}-bg)`, ['--tone-fg' as string]: `var(--tone-${a.tone}-fg)` }}>
            <span className="notif-item__icon">
              <AlertTriangle aria-hidden="true" />
            </span>
            <span className="grow">
              <span className="notif-item__title" style={{ display: 'block' }}>
                {a.title}
              </span>
              <span className="notif-item__body" style={{ display: 'block' }}>
                {a.body}
              </span>
            </span>
          </Link>
        ))}

        {data?.items.map((n) => {
          const Icon = TYPE_ICON[n.type] ?? Bell;
          return (
            <Link
              key={n.id}
              href={n.link ?? '/sistema/notificacoes'}
              className={n.read ? 'notif-item' : 'notif-item notif-item--unread'}
              onClick={() => {
                if (!n.read) void markNotificationReadAction(n.id);
              }}
            >
              <span className="notif-item__icon">
                <Icon aria-hidden="true" />
              </span>
              <span className="grow">
                <span className="notif-item__title" style={{ display: 'block' }}>
                  {n.title}
                </span>
                {n.body ? (
                  <span className="notif-item__body" style={{ display: 'block' }}>
                    {n.body}
                  </span>
                ) : null}
                <span className="notif-item__time">{timeAgo(n.createdAt)}</span>
              </span>
            </Link>
          );
        })}

        {data && data.items.length === 0 && data.alerts.length === 0 ? <p className="global-search__empty">Tudo em dia. Nenhuma notificação.</p> : null}
        <div className="notif-panel__foot">
          <Link href="/sistema/notificacoes" className="btn btn--sm btn--ghost">
            Ver todas as notificações
          </Link>
        </div>
      </Menu>
    </div>
  );
}

'use server';

import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/server/auth/session';
import { markAllRead, markRead } from '@/server/services/notifications';

export async function markAllNotificationsReadAction(): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  if (!user || user.mustChangePassword) return { ok: false };
  await markAllRead(user);
  revalidatePath('/sistema', 'layout');
  return { ok: true };
}

export async function markNotificationReadAction(id: number): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  if (!user || user.mustChangePassword || !Number.isInteger(id)) return { ok: false };
  await markRead(user, id);
  return { ok: true };
}

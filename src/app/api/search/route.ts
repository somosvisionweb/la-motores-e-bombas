import { NextResponse } from 'next/server';
import { getSessionUser } from '@/server/auth/session';
import { globalSearch } from '@/server/services/search';

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user || user.mustChangePassword) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  const q = new URL(request.url).searchParams.get('q') ?? '';
  return NextResponse.json(await globalSearch(q, user), { headers: { 'Cache-Control': 'no-store' } });
}

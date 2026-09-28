import { NextResponse } from 'next/server';
import { getSessionUser } from '@/server/auth/session';
import { hasPermission } from '@/server/auth/types';
import { searchServicesForSelect } from '@/server/services/catalog-services';
import { searchCustomersForSelect } from '@/server/services/customers';
import { searchProductsForSelect } from '@/server/services/products';

/** Consultas rápidas para os seletores (cliente, produto, serviço), respeitando as permissões do usuário. */
export async function GET(request: Request, context: { params: Promise<{ kind: string }> }) {
  const user = await getSessionUser();
  if (!user || user.mustChangePassword) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const { kind } = await context.params;
  const q = (new URL(request.url).searchParams.get('q') ?? '').slice(0, 80);
  const headers = { 'Cache-Control': 'no-store' };

  if (kind === 'customers' && hasPermission(user, 'customers.view')) {
    return NextResponse.json({ results: await searchCustomersForSelect(q, 8) }, { headers });
  }
  if (kind === 'products' && hasPermission(user, 'products.view')) {
    return NextResponse.json({ results: await searchProductsForSelect(q, 8) }, { headers });
  }
  if (kind === 'services' && hasPermission(user, 'services.view')) {
    return NextResponse.json({ results: await searchServicesForSelect(q, 8) }, { headers });
  }
  return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
}

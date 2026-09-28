import { NextResponse, type NextRequest } from 'next/server';

/**
 * Checagem OTIMISTA de acesso: quem não tem cookie de sessão é enviado ao login antes de renderizar.
 * A validação real (sessão no banco, usuário ativo, permissões) acontece no servidor a cada página/ação.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!request.cookies.has('la_session')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // após o login, documentos voltam para a página de impressão; o sistema, para a rota original
    const next = pathname.startsWith('/sistema') ? pathname + search : '/sistema';
    url.search = `?next=${encodeURIComponent(next)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/sistema/:path*', '/imprimir/:path*'],
};

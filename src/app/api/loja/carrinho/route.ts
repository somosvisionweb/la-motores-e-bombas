import { NextResponse } from 'next/server';
import { resolveCart } from '@/server/services/store';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 4000;

/** Lê o corpo da requisição até o limite (corta corpos gigantes sem carregá-los inteiros na memória). */
async function readLimitedText(request: Request, limit: number): Promise<string | null> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limit) return null;
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Confere o carrinho do navegador (produto + quantidade) e devolve preços, disponibilidade e problemas.
 * Público e somente leitura: o servidor é quem decide preço e estoque (o navegador nunca envia valores).
 */
export async function POST(request: Request) {
  const text = await readLimitedText(request, MAX_BODY_BYTES);
  if (text === null) return NextResponse.json({ error: 'Carrinho grande demais.' }, { status: 413 });

  let items: unknown = [];
  try {
    const body = JSON.parse(text) as { items?: unknown };
    items = body.items;
  } catch {
    return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
  }

  const resolution = await resolveCart(items);
  return NextResponse.json(resolution, { headers: { 'Cache-Control': 'no-store' } });
}

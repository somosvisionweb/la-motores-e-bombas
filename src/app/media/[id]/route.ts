import { getFile } from '@/server/services/files';

/** Serve logo, imagens do site e fotos de produtos (arquivos são imutáveis: cada envio gera um novo id). */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const fileId = Number(id);
  if (!Number.isInteger(fileId) || fileId <= 0) return new Response('Não encontrado', { status: 404 });

  const file = await getFile(fileId);
  if (!file) return new Response('Não encontrado', { status: 404 });

  return new Response(new Uint8Array(file.data), {
    headers: {
      'Content-Type': file.mimeType,
      'Content-Length': String(file.data.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; sandbox",
    },
  });
}

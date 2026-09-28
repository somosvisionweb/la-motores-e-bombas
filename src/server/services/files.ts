/**
 * Arquivos enviados (logo, imagens do site, fotos de produtos).
 * Tudo é validado pelo conteúdo real (não pelo tipo informado), redimensionado e otimizado.
 * SVG é rasterizado no envio (nunca servimos SVG enviado por usuário, evitando scripts embutidos).
 * Os arquivos ficam no banco (tabela `files`): backups simples e funciona em hospedagem sem disco persistente.
 */
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import sharp from 'sharp';
import { BusinessError } from '../auth/errors';
import type { Actor } from '../auth/types';
import { getDb, runWrite, type Tx } from '../db/client';
import { companySettings, files, products, siteImages } from '../db/schema';
import { audit } from './audit';

export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
const ACCEPTED_FORMATS = new Set(['png', 'jpeg', 'webp', 'svg', 'gif']);

type FileKind = 'LOGO' | 'SITE_IMAGE' | 'PRODUCT_IMAGE';

interface ProcessedImage {
  data: Buffer;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export async function processImage(input: Buffer, kind: FileKind): Promise<ProcessedImage> {
  if (input.length === 0) throw new BusinessError('Selecione uma imagem.');
  if (input.length > MAX_UPLOAD_BYTES) throw new BusinessError('A imagem deve ter no máximo 6 MB.');

  let format: string | undefined;
  try {
    format = (await sharp(input, { limitInputPixels: 50_000_000 }).metadata()).format;
  } catch {
    throw new BusinessError('Arquivo de imagem inválido. Use PNG, JPG, WebP ou SVG.');
  }
  if (!format || !ACCEPTED_FORMATS.has(format)) {
    throw new BusinessError('Formato não suportado. Use PNG, JPG, WebP ou SVG.');
  }

  try {
    const base = sharp(input, { limitInputPixels: 50_000_000, density: format === 'svg' ? 300 : undefined }).rotate();
    if (kind === 'LOGO') {
      const { data, info } = await base
        .resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true })
        .png({ compressionLevel: 9 })
        .toBuffer({ resolveWithObject: true });
      return { data, mimeType: 'image/png', width: info.width, height: info.height, sizeBytes: data.length };
    }
    const max = kind === 'PRODUCT_IMAGE' ? 1000 : 1800;
    const { data, info } = await base
      .resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { data, mimeType: 'image/webp', width: info.width, height: info.height, sizeBytes: data.length };
  } catch {
    throw new BusinessError('Não foi possível processar a imagem enviada.');
  }
}

async function insertFile(tx: Tx, image: ProcessedImage, kind: FileKind, fileName: string, actor: Actor): Promise<number> {
  const [row] = await tx
    .insert(files)
    .values({
      kind,
      fileName: fileName.slice(0, 200),
      mimeType: image.mimeType,
      sizeBytes: image.sizeBytes,
      width: image.width,
      height: image.height,
      data: image.data,
      createdBy: actor.id,
    })
    .returning({ id: files.id });
  return row!.id;
}

export async function getFile(id: number) {
  const [row] = await getDb().select().from(files).where(eq(files.id, id)).limit(1);
  return row ?? null;
}

async function deleteFiles(tx: Tx, ids: (number | null | undefined)[]) {
  const list = ids.filter((id): id is number => typeof id === 'number');
  if (list.length) await tx.delete(files).where(inArray(files.id, list));
}

// ---------- Logo da empresa ----------

export async function setCompanyLogo(input: Buffer, fileName: string, actor: Actor): Promise<void> {
  const image = await processImage(input, 'LOGO');
  await runWrite(async (tx) => {
    const [settings] = await tx.select({ logoFileId: companySettings.logoFileId }).from(companySettings).where(eq(companySettings.id, 1));
    const fileId = await insertFile(tx, image, 'LOGO', fileName, actor);
    await tx.update(companySettings).set({ logoFileId: fileId, updatedBy: actor.id }).where(eq(companySettings.id, 1));
    await deleteFiles(tx, [settings?.logoFileId]);
    await audit({ actor, action: 'LOGO_UPDATE', entityType: 'company_settings', entityId: 1, summary: 'Logo da empresa atualizada' });
  });
}

export async function removeCompanyLogo(actor: Actor): Promise<void> {
  await runWrite(async (tx) => {
    const [settings] = await tx.select({ logoFileId: companySettings.logoFileId }).from(companySettings).where(eq(companySettings.id, 1));
    await tx.update(companySettings).set({ logoFileId: null, updatedBy: actor.id }).where(eq(companySettings.id, 1));
    await deleteFiles(tx, [settings?.logoFileId]);
    await audit({ actor, action: 'LOGO_REMOVE', entityType: 'company_settings', entityId: 1, summary: 'Logo da empresa removida' });
  });
}

/** Bytes da logo (para PDFs). Retorna null quando não há logo enviada. */
export async function getCompanyLogoFile(logoFileId: number | null | undefined) {
  if (!logoFileId) return null;
  return getFile(logoFileId);
}

// ---------- Imagens do site ----------

export async function listSiteImages(slot?: 'HERO' | 'GALLERY') {
  const rows = await getDb()
    .select({
      id: siteImages.id,
      fileId: siteImages.fileId,
      slot: siteImages.slot,
      alt: siteImages.alt,
      sortOrder: siteImages.sortOrder,
      width: files.width,
      height: files.height,
    })
    .from(siteImages)
    .innerJoin(files, eq(files.id, siteImages.fileId))
    .where(slot ? eq(siteImages.slot, slot) : undefined)
    .orderBy(asc(siteImages.slot), asc(siteImages.sortOrder), asc(siteImages.id));
  return rows;
}

export async function addSiteImage(
  input: { buffer: Buffer; fileName: string; slot: 'HERO' | 'GALLERY'; alt: string },
  actor: Actor,
): Promise<void> {
  const image = await processImage(input.buffer, 'SITE_IMAGE');
  await runWrite(async (tx) => {
    if (input.slot === 'HERO') {
      // Só uma imagem principal: a nova substitui a anterior.
      const old = await tx.select({ id: siteImages.id, fileId: siteImages.fileId }).from(siteImages).where(eq(siteImages.slot, 'HERO'));
      if (old.length) {
        await tx.delete(siteImages).where(eq(siteImages.slot, 'HERO'));
        await deleteFiles(tx, old.map((o) => o.fileId));
      }
    } else {
      const existing = await tx.select({ id: siteImages.id }).from(siteImages).where(eq(siteImages.slot, 'GALLERY'));
      if (existing.length >= 12) throw new BusinessError('A galeria comporta até 12 imagens. Remova alguma antes de enviar outra.');
    }
    const fileId = await insertFile(tx, image, 'SITE_IMAGE', input.fileName, actor);
    const [last] = await tx
      .select({ max: sql<number>`coalesce(max(${siteImages.sortOrder}), -1)` })
      .from(siteImages)
      .where(eq(siteImages.slot, input.slot));
    await tx
      .insert(siteImages)
      .values({ fileId, slot: input.slot, alt: input.alt.trim().slice(0, 200), sortOrder: Number(last?.max ?? -1) + 1 });
    await audit({ actor, action: 'SITE_IMAGE_ADD', entityType: 'site_images', summary: `Imagem do site adicionada (${input.slot})` });
  });
}

export async function updateSiteImageAlt(id: number, alt: string, actor: Actor): Promise<void> {
  await runWrite(async (tx) => {
    await tx.update(siteImages).set({ alt: alt.trim().slice(0, 200) }).where(eq(siteImages.id, id));
    await audit({ actor, action: 'SITE_IMAGE_UPDATE', entityType: 'site_images', entityId: id, summary: 'Texto alternativo atualizado' });
  });
}

export async function deleteSiteImage(id: number, actor: Actor): Promise<void> {
  await runWrite(async (tx) => {
    const [row] = await tx.select().from(siteImages).where(eq(siteImages.id, id)).limit(1);
    if (!row) throw new BusinessError('Imagem não encontrada.');
    await tx.delete(siteImages).where(eq(siteImages.id, id));
    await deleteFiles(tx, [row.fileId]);
    await audit({ actor, action: 'SITE_IMAGE_DELETE', entityType: 'site_images', entityId: id, summary: 'Imagem do site removida' });
  });
}

// ---------- Foto de produto ----------

export async function setProductImage(productId: number, input: Buffer, fileName: string, actor: Actor): Promise<void> {
  const image = await processImage(input, 'PRODUCT_IMAGE');
  await runWrite(async (tx) => {
    const [product] = await tx.select({ imageFileId: products.imageFileId }).from(products).where(eq(products.id, productId));
    if (!product) throw new BusinessError('Produto não encontrado.');
    const fileId = await insertFile(tx, image, 'PRODUCT_IMAGE', fileName, actor);
    await tx.update(products).set({ imageFileId: fileId }).where(eq(products.id, productId));
    await deleteFiles(tx, [product.imageFileId]);
  });
}

export async function removeProductImage(productId: number): Promise<void> {
  await runWrite(async (tx) => {
    const [product] = await tx.select({ imageFileId: products.imageFileId }).from(products).where(and(eq(products.id, productId)));
    if (!product) return;
    await tx.update(products).set({ imageFileId: null }).where(eq(products.id, productId));
    await deleteFiles(tx, [product.imageFileId]);
  });
}

import sharp, { type Metadata } from 'sharp';
import { storage } from './storage/index.js';
import { badRequest } from '../errors.js';

export const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
export const VIDEO_MIMES = ['video/mp4', 'video/quicktime'];

/** Extensão definida pelo mimetype validado, nunca pelo nome do arquivo enviado. */
export const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'video/mp4': '.mp4', 'video/quicktime': '.mov',
};
const FORMAT_TO_MIME: Record<string, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/**
 * Gera miniatura WebP (máx. 900px). Usa o formato real detectado pelo sharp como
 * fonte da verdade: um SVG/HTML renomeado para .png é rejeitado.
 * Devolve dimensões e o mimetype real.
 */
export async function makeThumbnail(originalPath: string, thumbKey: string) {
  const img = sharp(originalPath, { failOn: 'none' }).rotate();
  let meta: Metadata;
  try { meta = await img.metadata(); } catch { throw badRequest('Imagem inválida ou corrompida. Use JPG, PNG ou WebP.'); }
  const mime = meta.format ? FORMAT_TO_MIME[meta.format] : undefined;
  if (!mime) throw badRequest('Imagem inválida. Use JPG, PNG ou WebP.');
  const buf = await img.resize({ width: 900, height: 900, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  await storage.saveBuffer(thumbKey, buf);
  return { width: meta.width ?? null, height: meta.height ?? null, mime };
}

import sharp from 'sharp';
import { storage } from './storage/index.js';

export const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
export const VIDEO_MIMES = ['video/mp4', 'video/quicktime'];

/** Gera miniatura WebP (máx. 900px) e devolve a chave + dimensões do original. */
export async function makeThumbnail(originalPath: string, thumbKey: string) {
  const img = sharp(originalPath, { failOn: 'none' }).rotate();
  const meta = await img.metadata();
  const buf = await img.resize({ width: 900, height: 900, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  await storage.saveBuffer(thumbKey, buf);
  return { width: meta.width ?? null, height: meta.height ?? null };
}

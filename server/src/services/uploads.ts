import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { storage, tmpDir } from './storage/index.js';
import { IMAGE_MIMES, VIDEO_MIMES, EXT_BY_MIME, makeThumbnail } from './thumbnails.js';
import { query, type Queryable } from '../db.js';
import { badRequest } from '../errors.js';

fs.mkdirSync(tmpDir, { recursive: true });

export const upload = multer({
  storage: multer.diskStorage({
    destination: tmpDir,
    filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: config.maxUploadBytes, files: 40 },
  fileFilter: (_req, file, cb) => {
    if ([...IMAGE_MIMES, ...VIDEO_MIMES].includes(file.mimetype)) cb(null, true);
    else cb(badRequest(`Formato não suportado: ${file.mimetype}. Use JPG, PNG, WebP ou MP4.`));
  },
});

export const logoUpload = multer({
  storage: multer.diskStorage({ destination: tmpDir, filename: (_r, f, cb) => cb(null, `${crypto.randomUUID()}${path.extname(f.originalname).toLowerCase()}`) }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_MIMES.includes(file.mimetype)) cb(null, true);
    else cb(badRequest('Logo precisa ser JPG, PNG ou WebP'));
  },
});

export interface IncomingFile { path: string; mimetype: string; size: number; originalname: string }

/**
 * Move os arquivos do tmp para o storage definitivo, gera thumbs e grava creative_assets.
 * A extensão vem do mimetype validado (para imagens, do formato real lido pelo sharp),
 * nunca do nome enviado pelo navegador.
 */
export async function attachAssets(files: IncomingFile[], batchId: number, versionId: number, db: Queryable) {
  let order = 0;
  for (const f of files) {
    const id = crypto.randomUUID();
    let mime = f.mimetype;
    let thumbKey: string | null = null;
    let dims: { width: number | null; height: number | null } = { width: null, height: null };
    if (IMAGE_MIMES.includes(f.mimetype)) {
      thumbKey = `batches/${batchId}/${id}_thumb.webp`;
      const t = await makeThumbnail(f.path, thumbKey);
      dims = { width: t.width, height: t.height };
      mime = t.mime;
    }
    const ext = EXT_BY_MIME[mime];
    if (!ext) throw badRequest(`Formato não suportado: ${mime}`);
    const fileKey = `batches/${batchId}/${id}${ext}`;
    await storage.saveFromPath(fileKey, f.path);
    await query(
      `INSERT INTO creative_assets (version_id, file_key, thumb_key, mime, width, height, size_bytes, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [versionId, fileKey, thumbKey, mime, dims.width, dims.height, f.size, order++], db,
    );
  }
}

export async function cleanupTmp(files: IncomingFile[] | undefined) {
  for (const f of files ?? []) await fs.promises.unlink(f.path).catch(() => {});
}

export function assetUrls<T extends { file_key: string; thumb_key: string | null }>(a: T) {
  return { ...a, url: storage.url(a.file_key), thumb_url: a.thumb_key ? storage.url(a.thumb_key) : null };
}

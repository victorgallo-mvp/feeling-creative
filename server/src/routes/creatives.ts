import { Router } from 'express';
import { z } from 'zod';
import { query, one, tx } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { notFound, badRequest } from '../errors.js';
import { logEvent } from '../services/events.js';
import { upload, attachAssets, cleanupTmp, assetUrls } from '../services/uploads.js';
import { recomputeBatchStatus } from '../services/batchStatus.js';
import { creativesOfBatch } from '../services/creativeQueries.js';
import { storage } from '../services/storage/index.js';

export const creativesRouter = Router();
creativesRouter.use(['/batches/:batchId/creatives', '/creatives'], requireAuth);

const TYPES = ['estatica', 'carrossel', 'story', 'video'] as const;
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal(''));

/**
 * Upload dentro de um lote.
 * mode=each  (padrão): cada arquivo vira uma arte (estática ou vídeo pelo mime).
 * mode=single: todos os arquivos viram UMA arte (carrossel).
 */
creativesRouter.post('/batches/:batchId/creatives', upload.array('files', 40), async (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  try {
    if (!files.length) throw badRequest('Nenhum arquivo enviado');
    const b = z.object({
      mode: z.enum(['each', 'single']).default('each'),
      type: z.enum(TYPES).optional(),
      caption: z.string().optional().default(''),
      scheduled_date: dateSchema,
    }).parse(req.body);
    const batch = await one(`SELECT id FROM batches WHERE id = $1`, [req.params.batchId]);
    if (!batch) throw notFound('Lote não encontrado');
    const batchId = batch.id as number;

    const groups = b.mode === 'single' ? [files] : files.map((f) => [f]);
    const created = await tx(async (db) => {
      const maxOrder = (await one<{ m: number }>(`SELECT coalesce(max(sort_order), 0)::int AS m FROM creatives WHERE batch_id=$1`, [batchId], db))!.m;
      const ids: number[] = [];
      let order = maxOrder;
      for (const g of groups) {
        const type = b.type ?? (g.length > 1 ? 'carrossel' : g[0].mimetype.startsWith('video') ? 'video' : 'estatica');
        if (type === 'video' && !g.every((f) => f.mimetype.startsWith('video'))) throw badRequest('Arte do tipo vídeo precisa de arquivo MP4');
        if (type !== 'video' && g.some((f) => f.mimetype.startsWith('video'))) throw badRequest('Arquivo de vídeo só pode ser usado em arte do tipo vídeo');
        const cr = await one(
          `INSERT INTO creatives (batch_id, type, caption, scheduled_date, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [batchId, type, b.caption, b.scheduled_date || null, ++order], db,
        );
        const v = await one(`INSERT INTO creative_versions (creative_id, version, created_by) VALUES ($1,1,$2) RETURNING id`, [cr!.id, req.user!.id], db);
        await attachAssets(g, batchId, v!.id, db);
        await logEvent({ batch_id: batchId, creative_id: cr!.id, kind: 'creative_uploaded', payload: { type, files: g.length }, actor_id: req.user!.id }, db);
        ids.push(cr!.id);
      }
      return ids;
    });
    await recomputeBatchStatus(batchId);
    const all = await creativesOfBatch(batchId);
    res.status(201).json(all.filter((c) => created.includes(c.id)));
  } finally {
    await cleanupTmp(files);
  }
});

creativesRouter.put('/creatives/:id', async (req, res) => {
  const b = z.object({
    caption: z.string().optional(),
    type: z.enum(TYPES).optional(),
    scheduled_date: dateSchema,
    sort_order: z.number().int().optional(),
  }).parse(req.body);
  const cur = await one(`SELECT * FROM creatives WHERE id = $1`, [req.params.id]);
  if (!cur) throw notFound('Arte não encontrada');
  await query(
    `UPDATE creatives SET caption=$2, type=$3, scheduled_date=$4, sort_order=$5 WHERE id=$1`,
    [cur.id, b.caption ?? cur.caption, b.type ?? cur.type, b.scheduled_date === undefined ? cur.scheduled_date : (b.scheduled_date || null), b.sort_order ?? cur.sort_order],
  );
  const all = await creativesOfBatch(cur.batch_id);
  res.json(all.find((c) => c.id === cur.id));
});

/** Reordena os assets (carrossel) da versão vigente. */
creativesRouter.put('/creatives/:id/assets/order', async (req, res) => {
  const { asset_ids } = z.object({ asset_ids: z.array(z.number().int()) }).parse(req.body);
  const cur = await one(`SELECT cr.id, cr.batch_id, v.id AS version_id FROM creatives cr JOIN creative_versions v ON v.creative_id=cr.id AND v.version=cr.current_version WHERE cr.id=$1`, [req.params.id]);
  if (!cur) throw notFound('Arte não encontrada');
  await tx(async (db) => {
    for (let i = 0; i < asset_ids.length; i++) {
      await query(`UPDATE creative_assets SET sort_order=$3 WHERE id=$1 AND version_id=$2`, [asset_ids[i], cur.version_id, i], db);
    }
  });
  const all = await creativesOfBatch(cur.batch_id);
  res.json(all.find((c) => c.id === cur.id));
});

creativesRouter.delete('/creatives/:id', async (req, res) => {
  const cur = await one(`SELECT * FROM creatives WHERE id = $1`, [req.params.id]);
  if (!cur) throw notFound('Arte não encontrada');
  const keys = await query<{ file_key: string; thumb_key: string | null }>(
    `SELECT a.file_key, a.thumb_key FROM creative_assets a JOIN creative_versions v ON v.id=a.version_id WHERE v.creative_id=$1`, [cur.id]);
  await query(`DELETE FROM creatives WHERE id = $1`, [cur.id]);
  for (const k of keys) { await storage.delete(k.file_key); if (k.thumb_key) await storage.delete(k.thumb_key); }
  await recomputeBatchStatus(cur.batch_id);
  res.status(204).end();
});

/** Nova versão (v2, v3...) de uma arte. Volta a pendente no link do cliente. */
creativesRouter.post('/creatives/:id/versions', upload.array('files', 20), async (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  try {
    if (!files.length) throw badRequest('Envie ao menos um arquivo para a nova versão');
    const b = z.object({ note: z.string().optional(), caption: z.string().optional() }).parse(req.body);
    const cur = await one(`SELECT * FROM creatives WHERE id = $1`, [req.params.id]);
    if (!cur) throw notFound('Arte não encontrada');
    const version = cur.current_version + 1;
    await tx(async (db) => {
      const v = await one(`INSERT INTO creative_versions (creative_id, version, note, created_by) VALUES ($1,$2,$3,$4) RETURNING id`, [cur.id, version, b.note || null, req.user!.id], db);
      await attachAssets(files, cur.batch_id, v!.id, db);
      await query(`UPDATE creatives SET current_version=$2, status='pending', caption=$3 WHERE id=$1`, [cur.id, version, b.caption ?? cur.caption], db);
      await query(`UPDATE events SET read_at = now() WHERE creative_id=$1 AND kind='creative_rejected' AND read_at IS NULL`, [cur.id], db);
      await logEvent({ batch_id: cur.batch_id, creative_id: cur.id, kind: 'version_uploaded', payload: { version, note: b.note || null }, actor_id: req.user!.id }, db);
    });
    await recomputeBatchStatus(cur.batch_id);
    const all = await creativesOfBatch(cur.batch_id);
    res.status(201).json(all.find((c) => c.id === cur.id));
  } finally {
    await cleanupTmp(files);
  }
});

/** Timeline completa da arte: eventos, versões (com assets) e decisões. */
creativesRouter.get('/creatives/:id/timeline', async (req, res) => {
  const cur = await one(`SELECT * FROM creatives WHERE id = $1`, [req.params.id]);
  if (!cur) throw notFound('Arte não encontrada');
  const events = await query(
    `SELECT e.*, u.name AS actor_name FROM events e LEFT JOIN users u ON u.id=e.actor_id
      WHERE e.creative_id = $1 OR (e.batch_id = $2 AND e.creative_id IS NULL AND e.kind IN ('link_sent','link_viewed','batch_submitted'))
      ORDER BY e.created_at, e.id`, [cur.id, cur.batch_id]);
  const versions = await query(`SELECT v.*, u.name AS created_by_name FROM creative_versions v LEFT JOIN users u ON u.id=v.created_by WHERE v.creative_id=$1 ORDER BY v.version`, [cur.id]);
  const assets = await query(`SELECT * FROM creative_assets WHERE version_id = ANY($1::int[]) ORDER BY sort_order, id`, [versions.map((v) => v.id)]);
  const decisions = await query(`SELECT * FROM decisions WHERE creative_id=$1 ORDER BY version`, [cur.id]);
  res.json({
    creative: cur,
    events,
    versions: versions.map((v) => ({ ...v, assets: assets.filter((a) => a.version_id === v.id).map(assetUrls), decision: decisions.find((d) => d.version === v.version) ?? null })),
  });
});

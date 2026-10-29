import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { storage } from '../services/storage/index.js';

/**
 * Alertas do painel inicial: só "cliente enviou a aprovação" e "cliente recusou N artes",
 * agrupados por lote, até serem dispensados. Tudo o mais fica no Histórico (abaixo).
 */
export const alertsRouter = Router();
alertsRouter.use(requireAuth);

alertsRouter.get('/', async (_req, res) => {
  const rows = await query(`
    SELECT e.kind, e.batch_id, b.month, b.year, b.title, c.id AS client_id, c.name AS client_name, c.logo_key,
           count(*)::int AS count, max(e.created_at) AS at, array_agg(e.id ORDER BY e.id) AS event_ids,
           max(CASE WHEN e.kind = 'batch_submitted' THEN (e.payload->>'rating')::int END) AS rating,
           max(CASE WHEN e.kind = 'batch_submitted' THEN e.payload->>'comment' END) AS comment,
           (SELECT count(*)::int FROM creatives WHERE batch_id = e.batch_id AND status = 'rejected') AS rejected_now
      FROM events e
      JOIN batches b ON b.id = e.batch_id
      JOIN clients c ON c.id = b.client_id
     WHERE e.kind IN ('batch_submitted', 'creative_rejected') AND e.dismissed_at IS NULL AND c.deleted_at IS NULL
     GROUP BY e.kind, e.batch_id, b.month, b.year, b.title, c.id, c.name, c.logo_key
     ORDER BY max(e.created_at) DESC
     LIMIT 50`);
  res.json(rows.map((r) => ({ ...r, client_logo_url: r.logo_key ? storage.url(r.logo_key) : null, logo_key: undefined })));
});

alertsRouter.post('/dismiss', async (req, res) => {
  const { event_ids } = z.object({ event_ids: z.array(z.number().int()).min(1).max(500) }).parse(req.body);
  await query(`UPDATE events SET dismissed_at = now() WHERE id = ANY($1::int[]) AND dismissed_at IS NULL`, [event_ids]);
  res.json({ ok: true });
});

alertsRouter.post('/dismiss-all', async (_req, res) => {
  await query(`UPDATE events SET dismissed_at = now() WHERE kind IN ('batch_submitted', 'creative_rejected') AND dismissed_at IS NULL`);
  res.json({ ok: true });
});

/** Histórico completo de movimentação, só consulta: sem badge, sem alerta. */
export const activityRouter = Router();
activityRouter.use(requireAuth);

activityRouter.get('/', async (req, res) => {
  const q = z.object({
    client_id: z.coerce.number().int().optional(),
    batch_id: z.coerce.number().int().optional(),
    kind: z.string().max(40).optional(),
    source: z.enum(['client', 'team']).optional(),
    limit: z.coerce.number().int().min(1).max(500).default(200),
  }).parse(req.query);
  const where: string[] = ['c.deleted_at IS NULL'];
  const params: any[] = [];
  if (q.client_id) { params.push(q.client_id); where.push(`b.client_id = $${params.length}`); }
  if (q.batch_id) { params.push(q.batch_id); where.push(`e.batch_id = $${params.length}`); }
  if (q.kind) { params.push(q.kind); where.push(`e.kind = $${params.length}`); }
  if (q.source === 'client') where.push(`e.actor_id IS NULL`);
  if (q.source === 'team') where.push(`e.actor_id IS NOT NULL`);
  params.push(q.limit);
  const rows = await query(`
    SELECT e.id, e.kind, e.payload, e.created_at, e.creative_id, e.batch_id,
           b.month, b.year, b.title, c.id AS client_id, c.name AS client_name, c.logo_key,
           cr.sort_order AS creative_index, cr.type AS creative_type, u.name AS actor_name
      FROM events e
      JOIN batches b ON b.id = e.batch_id
      JOIN clients c ON c.id = b.client_id
      LEFT JOIN creatives cr ON cr.id = e.creative_id
      LEFT JOIN users u ON u.id = e.actor_id
     WHERE ${where.join(' AND ')}
     ORDER BY e.created_at DESC, e.id DESC
     LIMIT $${params.length}`, params);
  res.json(rows.map((r) => ({ ...r, client_logo_url: r.logo_key ? storage.url(r.logo_key) : null, logo_key: undefined })));
});

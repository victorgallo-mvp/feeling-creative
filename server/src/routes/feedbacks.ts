import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { storage } from '../services/storage/index.js';

/**
 * Feedbacks dos clientes (nota 1–5 + frase dados ao enviar a aprovação).
 * Vivem em `batches.feedback_*`; aqui só há leitura, filtros, agregados e "marcar como visto".
 */
export const feedbacksRouter = Router();
feedbacksRouter.use(requireAuth);

const SELECT = `
  SELECT b.id AS batch_id, b.client_id, b.month, b.year, b.title,
         b.feedback_rating AS rating, b.feedback_comment AS comment, b.feedback_at AS at, b.feedback_read_at AS read_at,
         c.name AS client_name, c.logo_key, c.instagram_handle,
         d.name AS designer_name, m.name AS manager_name,
         (SELECT count(*)::int FROM creatives WHERE batch_id = b.id) AS total
    FROM batches b
    JOIN clients c ON c.id = b.client_id
    LEFT JOIN users d ON d.id = c.designer_id
    LEFT JOIN users m ON m.id = c.manager_id
   WHERE b.feedback_rating IS NOT NULL AND c.deleted_at IS NULL`;

feedbacksRouter.get('/', async (req, res) => {
  const q = z.object({
    client_id: z.coerce.number().int().optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
    year: z.coerce.number().int().optional(),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    unread: z.enum(['1']).optional(),
  }).parse(req.query);
  const where: string[] = [];
  const params: any[] = [];
  if (q.client_id) { params.push(q.client_id); where.push(`b.client_id = $${params.length}`); }
  if (q.month) { params.push(q.month); where.push(`b.month = $${params.length}`); }
  if (q.year) { params.push(q.year); where.push(`b.year = $${params.length}`); }
  if (q.rating) { params.push(q.rating); where.push(`b.feedback_rating = $${params.length}`); }
  if (q.unread) where.push(`b.feedback_read_at IS NULL`);
  const extra = where.length ? ` AND ${where.join(' AND ')}` : '';
  const rows = await query(`${SELECT}${extra} ORDER BY b.feedback_at DESC LIMIT 300`, params);
  // agregados do mesmo recorte de filtros
  const [s] = await query(
    `SELECT count(*)::int AS total,
            round(avg(b.feedback_rating)::numeric, 2)::float AS avg,
            count(*) FILTER (WHERE b.feedback_read_at IS NULL)::int AS unread,
            count(*) FILTER (WHERE b.feedback_rating <= 2)::int AS low,
            json_build_object(
              '1', count(*) FILTER (WHERE b.feedback_rating = 1),
              '2', count(*) FILTER (WHERE b.feedback_rating = 2),
              '3', count(*) FILTER (WHERE b.feedback_rating = 3),
              '4', count(*) FILTER (WHERE b.feedback_rating = 4),
              '5', count(*) FILTER (WHERE b.feedback_rating = 5)) AS dist
       FROM batches b JOIN clients c ON c.id = b.client_id
      WHERE b.feedback_rating IS NOT NULL AND c.deleted_at IS NULL${extra}`, params);
  res.json({
    summary: s,
    items: rows.map((r) => ({ ...r, client_logo_url: r.logo_key ? storage.url(r.logo_key) : null, logo_key: undefined })),
  });
});

feedbacksRouter.get('/count', async (_req, res) => {
  const [r] = await query(
    `SELECT count(*)::int AS n, count(*) FILTER (WHERE b.feedback_rating <= 2)::int AS low
       FROM batches b JOIN clients c ON c.id = b.client_id
      WHERE b.feedback_rating IS NOT NULL AND b.feedback_read_at IS NULL AND c.deleted_at IS NULL`);
  res.json(r);
});

feedbacksRouter.post('/read-all', async (_req, res) => {
  await query(`UPDATE batches SET feedback_read_at = now() WHERE feedback_rating IS NOT NULL AND feedback_read_at IS NULL`);
  res.json({ ok: true });
});

feedbacksRouter.post('/:batchId/read', async (req, res) => {
  const id = z.coerce.number().int().parse(req.params.batchId);
  await query(`UPDATE batches SET feedback_read_at = now() WHERE id = $1 AND feedback_rating IS NOT NULL`, [id]);
  res.json({ ok: true });
});

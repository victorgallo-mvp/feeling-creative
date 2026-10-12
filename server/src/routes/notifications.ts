import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { storage } from '../services/storage/index.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

const SELECT = `
  SELECT e.id, e.created_at, e.read_at, e.payload, e.creative_id, e.batch_id,
         c.name AS client_name, b.month, b.year, cr.type AS creative_type, cr.sort_order, cr.status AS creative_status,
         (SELECT thumb_key FROM creative_assets a JOIN creative_versions v ON v.id=a.version_id
           WHERE v.creative_id=cr.id AND v.version=(e.payload->>'version')::int ORDER BY a.sort_order LIMIT 1) AS thumb_key
    FROM events e
    JOIN batches b ON b.id = e.batch_id
    JOIN clients c ON c.id = b.client_id
    JOIN creatives cr ON cr.id = e.creative_id
   WHERE e.kind = 'creative_rejected'`;

notificationsRouter.get('/', async (req, res) => {
  const all = req.query.all === '1';
  const rows = await query(`${SELECT} ${all ? '' : 'AND e.read_at IS NULL'} ORDER BY e.created_at DESC LIMIT 100`);
  res.json(rows.map((r) => ({ ...r, thumb_url: r.thumb_key ? storage.url(r.thumb_key) : null })));
});

notificationsRouter.get('/count', async (_req, res) => {
  const [r] = await query(`SELECT count(*)::int AS n FROM events WHERE kind='creative_rejected' AND read_at IS NULL`);
  res.json(r);
});

notificationsRouter.post('/:id/read', async (req, res) => {
  await query(`UPDATE events SET read_at = now() WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

notificationsRouter.post('/read-all', async (_req, res) => {
  await query(`UPDATE events SET read_at = now() WHERE kind='creative_rejected' AND read_at IS NULL`);
  res.json({ ok: true });
});

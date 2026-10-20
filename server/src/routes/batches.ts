import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { query, one, tx } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notFound, badRequest } from '../errors.js';
import { logEvent } from '../services/events.js';
import { creativesOfBatch } from '../services/creativeQueries.js';
import { buildMessage, waUrl, batchLabel, publicLink } from '../services/message.js';
import { storage } from '../services/storage/index.js';
import { config } from '../config.js';

export const batchesRouter = Router();
batchesRouter.use(requireAuth);

const LIST = `
  SELECT b.*, c.name AS client_name, c.logo_key AS client_logo_key, c.instagram_handle, c.whatsapp,
         d.name AS designer_name, m.name AS manager_name,
         (SELECT count(*)::int FROM creatives WHERE batch_id = b.id) AS total,
         (SELECT count(*)::int FROM creatives WHERE batch_id = b.id AND status IN ('approved','auto_approved')) AS approved,
         (SELECT count(*)::int FROM creatives WHERE batch_id = b.id AND status = 'rejected') AS rejected,
         (SELECT count(*)::int FROM creatives WHERE batch_id = b.id AND status = 'pending') AS pending
    FROM batches b
    JOIN clients c ON c.id = b.client_id
    LEFT JOIN users d ON d.id = c.designer_id
    LEFT JOIN users m ON m.id = c.manager_id`;

function decorate(b: any) {
  const stuckMs = config.stuckDays * 24 * 3600 * 1000;
  const stuck = b.kanban_status === 'enviado_aprovacao' && Date.now() - new Date(b.status_changed_at).getTime() > stuckMs;
  return { ...b, client_logo_url: b.client_logo_key ? storage.url(b.client_logo_key) : null, stuck, link: b.link_token ? publicLink(b.link_token) : null };
}

batchesRouter.get('/', async (req, res) => {
  const q = z.object({ month: z.coerce.number().int().min(1).max(12).optional(), year: z.coerce.number().int().optional(), client_id: z.coerce.number().int().optional() }).parse(req.query);
  const where: string[] = ['c.deleted_at IS NULL'];
  const params: any[] = [];
  if (q.month) { params.push(q.month); where.push(`b.month = $${params.length}`); }
  if (q.year) { params.push(q.year); where.push(`b.year = $${params.length}`); }
  if (q.client_id) { params.push(q.client_id); where.push(`b.client_id = $${params.length}`); }
  const rows = await query(`${LIST} WHERE ${where.join(' AND ')} ORDER BY b.year DESC, b.month DESC, c.name`, params);
  res.json(rows.map(decorate));
});

batchesRouter.post('/', async (req, res) => {
  const b = z.object({ client_id: z.number().int(), month: z.number().int().min(1).max(12), year: z.number().int().min(2020), title: z.string().trim().max(80).optional().nullable() }).parse(req.body);
  const row = await tx(async (db) => {
    const r = await one(`INSERT INTO batches (client_id, month, year, title) VALUES ($1,$2,$3,$4) RETURNING *`, [b.client_id, b.month, b.year, b.title || null], db);
    await logEvent({ batch_id: r!.id, kind: 'batch_created', actor_id: req.user!.id }, db);
    return r;
  });
  res.status(201).json(row);
});

batchesRouter.get('/:id', async (req, res) => {
  const b = await one(`${LIST} WHERE b.id = $1`, [req.params.id]);
  if (!b) throw notFound('Lote não encontrado');
  const creatives = await creativesOfBatch(b.id);
  const events = await query(
    `SELECT e.*, u.name AS actor_name FROM events e LEFT JOIN users u ON u.id = e.actor_id WHERE e.batch_id = $1 ORDER BY e.created_at DESC, e.id DESC`, [b.id],
  );
  const msg = b.link_token ? await buildMessage({ clientName: b.client_name, token: b.link_token, count: creatives.length, batchLabel: batchLabel(b) }) : null;
  res.json({ ...decorate(b), creatives, events, link: msg?.link ?? null, message: msg?.text ?? null, wa_url: msg ? waUrl(b.whatsapp, msg.text) : null });
});

batchesRouter.patch('/:id/kanban', async (req, res) => {
  const { kanban_status } = z.object({ kanban_status: z.enum(['briefing', 'em_producao', 'programado']) }).parse(req.body);
  const cur = await one(`SELECT * FROM batches WHERE id = $1`, [req.params.id]);
  if (!cur) throw notFound('Lote não encontrado');
  if (kanban_status === 'programado' && cur.kanban_status !== 'aprovado') throw badRequest('Só é possível programar um lote 100% aprovado');
  if (kanban_status !== 'programado' && cur.link_sent_at) throw badRequest('Lote já enviado para aprovação; o status agora é automático');
  await tx(async (db) => {
    await query(`UPDATE batches SET kanban_status=$2, status_changed_at=now() WHERE id=$1`, [cur.id, kanban_status], db);
    await logEvent({ batch_id: cur.id, kind: 'kanban_moved', payload: { from: cur.kanban_status, to: kanban_status }, actor_id: req.user!.id }, db);
  });
  res.json({ ok: true });
});

/** Gera (ou rotaciona) o token do link público e devolve link + mensagem + wa.me */
batchesRouter.post('/:id/link', async (req, res) => {
  const { rotate } = z.object({ rotate: z.boolean().optional() }).parse(req.body ?? {});
  const b = await one(`${LIST} WHERE b.id = $1`, [req.params.id]);
  if (!b) throw notFound('Lote não encontrado');
  if (b.total === 0) throw badRequest('Suba ao menos uma arte antes de gerar o link');
  const token = !b.link_token || rotate ? crypto.randomBytes(24).toString('base64url') : b.link_token;
  await tx(async (db) => {
    await query(
      `UPDATE batches SET link_token=$2, link_sent_at=now(), viewed_at = CASE WHEN $3 THEN NULL ELSE viewed_at END,
              kanban_status = CASE WHEN kanban_status IN ('briefing','em_producao') THEN 'enviado_aprovacao'::kanban_status ELSE kanban_status END,
              status_changed_at = CASE WHEN kanban_status IN ('briefing','em_producao') THEN now() ELSE status_changed_at END
        WHERE id=$1`,
      [b.id, token, token !== b.link_token], db,
    );
    await logEvent({ batch_id: b.id, kind: 'link_sent', payload: { rotated: token !== b.link_token, creatives: b.total }, actor_id: req.user!.id }, db);
  });
  const msg = await buildMessage({ clientName: b.client_name, token, count: b.total, batchLabel: batchLabel(b) });
  res.json({ link: msg.link, message: msg.text, wa_url: waUrl(b.whatsapp, msg.text), token });
});

batchesRouter.patch('/:id', async (req, res) => {
  const b = z.object({ title: z.string().trim().max(80).nullable() }).parse(req.body);
  const r = await one(`UPDATE batches SET title=$2 WHERE id=$1 RETURNING *`, [req.params.id, b.title || null]);
  if (!r) throw notFound('Lote não encontrado');
  res.json(r);
});

batchesRouter.delete('/:id', requireRole('gestor'), async (req, res) => {
  const id = z.coerce.number().int().parse(req.params.id);
  const keys = await query<{ file_key: string; thumb_key: string | null }>(
    `SELECT a.file_key, a.thumb_key FROM creative_assets a
       JOIN creative_versions v ON v.id = a.version_id
       JOIN creatives c ON c.id = v.creative_id WHERE c.batch_id = $1`, [id]);
  const del = await query(`DELETE FROM batches WHERE id = $1 RETURNING id`, [id]);
  if (!del.length) throw notFound('Lote não encontrado');
  for (const k of keys) { await storage.delete(k.file_key); if (k.thumb_key) await storage.delete(k.thumb_key); }
  res.status(204).end();
});

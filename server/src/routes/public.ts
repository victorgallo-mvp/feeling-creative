import { Router } from 'express';
import { z } from 'zod';
import { query, one, tx } from '../db.js';
import { notFound, badRequest } from '../errors.js';
import { logEvent } from '../services/events.js';
import { creativesOfBatch } from '../services/creativeQueries.js';
import { recomputeBatchStatus } from '../services/batchStatus.js';
import { storage } from '../services/storage/index.js';

/** Rotas do link do cliente: sem login, o token é a única credencial. */
export const publicRouter = Router();

async function loadBatch(token: string) {
  if (!token || token.length < 24) throw notFound('Link inválido');
  const b = await one(
    `SELECT b.*, c.name AS client_name, c.logo_key, c.instagram_handle
       FROM batches b JOIN clients c ON c.id = b.client_id
      WHERE b.link_token = $1 AND c.deleted_at IS NULL`, [token]);
  if (!b) throw notFound('Esse link não existe ou foi substituído. Peça um novo link para a agência.');
  return b;
}

publicRouter.get('/:token', async (req, res) => {
  const b = await loadBatch(req.params.token);
  if (!b.viewed_at) {
    await tx(async (db) => {
      await query(`UPDATE batches SET viewed_at = now() WHERE id = $1 AND viewed_at IS NULL`, [b.id], db);
      await logEvent({ batch_id: b.id, kind: 'link_viewed', payload: { ua: req.headers['user-agent'] ?? null } }, db);
    });
  }
  const creatives = await creativesOfBatch(b.id);
  res.json({
    client: { name: b.client_name, logo_url: b.logo_key ? storage.url(b.logo_key) : null, instagram_handle: b.instagram_handle },
    batch: { id: b.id, month: b.month, year: b.year, submitted_at: b.submitted_at },
    creatives: creatives.map((c) => ({
      id: c.id, type: c.type, caption: c.caption, scheduled_date: c.scheduled_date, status: c.status,
      version: c.current_version, decision: c.decision,
      assets: c.assets.map((a) => ({ id: a.id, url: a.url, thumb_url: a.thumb_url, mime: a.mime, width: a.width, height: a.height })),
    })),
  });
});

publicRouter.post('/:token/decisions', async (req, res) => {
  const b = await loadBatch(req.params.token);
  const d = z.object({
    creative_id: z.number().int(),
    version: z.number().int(),
    action: z.enum(['approved', 'rejected']),
    reason_category: z.enum(['texto_legenda', 'identidade_visual', 'imagem', 'outro']).optional().nullable(),
    comment: z.string().max(2000).optional().nullable(),
  }).parse(req.body);
  if (d.action === 'rejected' && !d.reason_category) throw badRequest('Escolha um motivo para a recusa');

  const cr = await one(`SELECT * FROM creatives WHERE id = $1 AND batch_id = $2`, [d.creative_id, b.id]);
  if (!cr) throw notFound('Arte não encontrada');
  if (cr.current_version !== d.version) throw badRequest('Essa arte tem uma versão mais nova. Recarregue a página.');
  if (cr.status !== 'pending') return res.json({ ok: true, already: true, status: cr.status });

  await tx(async (db) => {
    await query(
      `INSERT INTO decisions (creative_id, version, action, reason_category, comment, source)
       VALUES ($1,$2,$3,$4,$5,'client') ON CONFLICT (creative_id, version) DO NOTHING`,
      [cr.id, d.version, d.action, d.action === 'rejected' ? d.reason_category : null, d.comment?.trim() || null], db,
    );
    await query(`UPDATE creatives SET status = $2 WHERE id = $1`, [cr.id, d.action], db);
    await logEvent({
      batch_id: b.id, creative_id: cr.id,
      kind: d.action === 'approved' ? 'creative_approved' : 'creative_rejected',
      payload: { version: d.version, reason_category: d.reason_category ?? null, comment: d.comment?.trim() || null },
    }, db);
  });
  await recomputeBatchStatus(b.id);
  res.json({ ok: true, status: d.action });
});

publicRouter.post('/:token/submit', async (req, res) => {
  const b = await loadBatch(req.params.token);
  const [c] = await query(
    `SELECT count(*) FILTER (WHERE status IN ('approved','auto_approved'))::int AS approved,
            count(*) FILTER (WHERE status = 'rejected')::int AS rejected,
            count(*) FILTER (WHERE status = 'pending')::int AS pending
       FROM creatives WHERE batch_id = $1`, [b.id]);
  await tx(async (db) => {
    await query(`UPDATE batches SET submitted_at = now() WHERE id = $1`, [b.id], db);
    await logEvent({ batch_id: b.id, kind: 'batch_submitted', payload: c }, db);
  });
  res.json({ ok: true, ...c });
});

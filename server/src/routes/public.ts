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
      // RETURNING garante um único evento mesmo com dois GETs simultâneos na primeira abertura
      const r = await query(`UPDATE batches SET viewed_at = now() WHERE id = $1 AND viewed_at IS NULL RETURNING id`, [b.id], db);
      if (r.length) await logEvent({ batch_id: b.id, kind: 'link_viewed', payload: { ua: req.headers['user-agent'] ?? null } }, db);
    });
  }
  const creatives = await creativesOfBatch(b.id);
  res.json({
    client: { name: b.client_name, logo_url: b.logo_key ? storage.url(b.logo_key) : null, instagram_handle: b.instagram_handle },
    batch: {
      id: b.id, month: b.month, year: b.year, title: b.title ?? null, submitted_at: b.submitted_at,
      feedback: b.feedback_rating ? { rating: b.feedback_rating, comment: b.feedback_comment, at: b.feedback_at } : null,
    },
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

  // A troca de status é atômica: só quem sair de 'pending' registra decisão e evento.
  // Protege contra dois responsáveis decidindo a mesma arte ao mesmo tempo.
  const applied = await tx(async (db) => {
    const upd = await query(
      `UPDATE creatives SET status = $2 WHERE id = $1 AND status = 'pending' AND current_version = $3 RETURNING id`,
      [cr.id, d.action, d.version], db,
    );
    if (!upd.length) return false;
    await query(
      `INSERT INTO decisions (creative_id, version, action, reason_category, comment, source)
       VALUES ($1,$2,$3,$4,$5,'client') ON CONFLICT (creative_id, version) DO NOTHING`,
      [cr.id, d.version, d.action, d.action === 'rejected' ? d.reason_category : null, d.comment?.trim() || null], db,
    );
    await logEvent({
      batch_id: b.id, creative_id: cr.id,
      kind: d.action === 'approved' ? 'creative_approved' : 'creative_rejected',
      payload: { version: d.version, reason_category: d.reason_category ?? null, comment: d.comment?.trim() || null },
    }, db);
    return true;
  });
  if (!applied) {
    const now = await one(`SELECT status FROM creatives WHERE id = $1`, [cr.id]);
    return res.json({ ok: true, already: true, status: now?.status ?? cr.status });
  }
  await recomputeBatchStatus(b.id);
  res.json({ ok: true, status: d.action });
});

/**
 * Troca uma decisão já dada. Só vale para decisão ainda não enviada: lote nunca enviado,
 * ou decisão tomada depois do último envio (rodada de novas versões). Depois de enviada, a
 * mudança passa a ser por nova versão com a agência.
 */
publicRouter.put('/:token/decisions/:creativeId', async (req, res) => {
  const b = await loadBatch(req.params.token);
  const d = z.object({
    version: z.number().int(),
    action: z.enum(['approved', 'rejected']),
    reason_category: z.enum(['texto_legenda', 'identidade_visual', 'imagem', 'outro']).optional().nullable(),
    comment: z.string().max(2000).optional().nullable(),
  }).parse(req.body);
  if (d.action === 'rejected' && !d.reason_category) throw badRequest('Escolha um motivo para a recusa');
  const cr = await one(`SELECT * FROM creatives WHERE id = $1 AND batch_id = $2`, [req.params.creativeId, b.id]);
  if (!cr) throw notFound('Arte não encontrada');
  if (cr.current_version !== d.version) throw badRequest('Essa arte tem uma versão mais nova. Recarregue a página.');
  if (cr.status === 'pending') throw badRequest('Essa arte ainda não foi respondida.');
  const prev = await one(`SELECT * FROM decisions WHERE creative_id = $1 AND version = $2`, [cr.id, d.version]);
  const locked = !!b.submitted_at && (!prev || new Date(prev.decided_at) <= new Date(b.submitted_at));
  if (locked) throw badRequest('Essa resposta já foi enviada para a agência. Para mudar, peça uma nova versão.');
  const from = cr.status;
  await tx(async (db) => {
    await query(`UPDATE creatives SET status = $2 WHERE id = $1`, [cr.id, d.action], db);
    await query(
      `INSERT INTO decisions (creative_id, version, action, reason_category, comment, source, decided_at)
       VALUES ($1,$2,$3,$4,$5,'client', now())
       ON CONFLICT (creative_id, version) DO UPDATE SET action = EXCLUDED.action, reason_category = EXCLUDED.reason_category, comment = EXCLUDED.comment, decided_at = now()`,
      [cr.id, d.version, d.action, d.action === 'rejected' ? d.reason_category : null, d.comment?.trim() || null], db,
    );
    const payload = { version: d.version, from, to: d.action, reason_category: d.action === 'rejected' ? d.reason_category : null, comment: d.comment?.trim() || null };
    await logEvent({ batch_id: b.id, creative_id: cr.id, kind: 'creative_decision_changed', payload }, db);
    if (d.action === 'rejected') {
      // entra na fila de Recusas e no alerta do painel como qualquer recusa
      await logEvent({ batch_id: b.id, creative_id: cr.id, kind: 'creative_rejected', payload: { version: d.version, reason_category: d.reason_category, comment: d.comment?.trim() || null, changed: true } }, db);
    } else {
      // deixou de ser recusa: tira a recusa anterior da fila e do alerta
      await query(`UPDATE events SET read_at = coalesce(read_at, now()), dismissed_at = coalesce(dismissed_at, now())
                    WHERE kind = 'creative_rejected' AND creative_id = $1 AND (payload->>'version')::int = $2`, [cr.id, d.version], db);
      await logEvent({ batch_id: b.id, creative_id: cr.id, kind: 'creative_approved', payload: { version: d.version, changed: true } }, db);
    }
  });
  await recomputeBatchStatus(b.id);
  res.json({ ok: true, status: d.action });
});

publicRouter.post('/:token/submit', async (req, res) => {
  const b = await loadBatch(req.params.token);
  // Feedback obrigatório: nota de 1 a 5 e uma frase. Sem os dois, o envio não é aceito.
  const fb = z.object({
    rating: z.coerce.number().int().min(1).max(5),
    comment: z.string().trim().min(3).max(1000),
  }).safeParse(req.body ?? {});
  if (!fb.success) {
    const field = fb.error.issues[0]?.path[0];
    throw badRequest(field === 'comment' ? 'Escreva uma frase sobre como foi a experiência (mín. 3 caracteres).' : 'Avalie a experiência de 1 a 5 estrelas.');
  }
  const result = await tx(async (db) => {
    const [c] = await query(
      `SELECT count(*) FILTER (WHERE status IN ('approved','auto_approved'))::int AS approved,
              count(*) FILTER (WHERE status = 'rejected')::int AS rejected,
              count(*) FILTER (WHERE status = 'pending')::int AS pending
         FROM creatives WHERE batch_id = $1`, [b.id], db);
    if (c.pending > 0) throw badRequest(`Ainda há ${c.pending} arte(s) sem resposta.`);
    await query(
      `UPDATE batches SET submitted_at = now(), feedback_rating = $2, feedback_comment = $3, feedback_at = now(), feedback_read_at = NULL WHERE id = $1`,
      [b.id, fb.data.rating, fb.data.comment], db,
    );
    await logEvent({ batch_id: b.id, kind: 'batch_submitted', payload: { ...c, rating: fb.data.rating, comment: fb.data.comment } }, db);
    return c;
  });
  res.json({ ok: true, ...result });
});

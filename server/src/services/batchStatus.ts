import { one, query, type Queryable, pool } from '../db.js';

/**
 * Regras do Kanban:
 * - briefing / em_producao / programado: manuais (drag & drop).
 * - enviado_aprovacao: automático ao gerar o link.
 * - aprovado: automático quando 100% das artes vigentes estão aprovadas (cliente ou auto).
 *   Uma recusa pendente devolve o lote para enviado_aprovacao até a nova versão ser aprovada.
 */
export async function recomputeBatchStatus(batchId: number, db: Queryable = pool) {
  const b = await one<{ kanban_status: string; link_sent_at: string | null }>(
    `SELECT kanban_status, link_sent_at FROM batches WHERE id = $1`, [batchId], db,
  );
  if (!b || !b.link_sent_at) return;
  if (!['enviado_aprovacao', 'aprovado'].includes(b.kanban_status)) return;

  const c = await one<{ total: string; approved: string }>(
    `SELECT count(*)::text AS total,
            count(*) FILTER (WHERE status IN ('approved','auto_approved'))::text AS approved
       FROM creatives WHERE batch_id = $1`, [batchId], db,
  );
  const total = Number(c?.total ?? 0);
  const approved = Number(c?.approved ?? 0);
  const next = total > 0 && approved === total ? 'aprovado' : 'enviado_aprovacao';
  if (next !== b.kanban_status) {
    await query(`UPDATE batches SET kanban_status = $2, status_changed_at = now() WHERE id = $1`, [batchId, next], db);
  }
}

import { one, query, type Queryable, pool } from '../db.js';

/**
 * Regras do Kanban:
 * - briefing / em_producao: manuais (drag & drop), enquanto o link não foi gerado.
 * - enviado_aprovacao: automático ao gerar o link, ou quando volta a existir arte pendente
 *   (nova versão ou arte nova) num lote já aprovado/programado.
 * - aprovado: automático quando 100% das artes vigentes estão aprovadas (cliente ou auto).
 * - programado: manual, a partir de aprovado; se tudo continua aprovado, permanece.
 */
export async function recomputeBatchStatus(batchId: number, db: Queryable = pool) {
  const b = await one<{ kanban_status: string; link_sent_at: string | null }>(
    `SELECT kanban_status, link_sent_at FROM batches WHERE id = $1`, [batchId], db,
  );
  if (!b || !b.link_sent_at) return;
  if (!['enviado_aprovacao', 'aprovado', 'programado'].includes(b.kanban_status)) return;

  const c = await one<{ total: string; approved: string }>(
    `SELECT count(*)::text AS total,
            count(*) FILTER (WHERE status IN ('approved','auto_approved'))::text AS approved
       FROM creatives WHERE batch_id = $1`, [batchId], db,
  );
  const total = Number(c?.total ?? 0);
  const approved = Number(c?.approved ?? 0);
  const allApproved = total > 0 && approved === total;
  const next = allApproved ? (b.kanban_status === 'programado' ? 'programado' : 'aprovado') : 'enviado_aprovacao';
  if (next !== b.kanban_status) {
    await query(`UPDATE batches SET kanban_status = $2, status_changed_at = now() WHERE id = $1`, [batchId, next], db);
  }
}

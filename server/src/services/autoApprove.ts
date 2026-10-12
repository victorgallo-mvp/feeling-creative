import cron from 'node-cron';
import { pool, query, tx } from '../db.js';
import { logEvent } from './events.js';
import { recomputeBatchStatus } from './batchStatus.js';
import { config } from '../config.js';

/**
 * Auto-aprovação. Só age em clientes com auto_approve_enabled = true
 * (desligado por padrão). O prazo conta a partir do maior entre o envio do link
 * e a criação da versão vigente, para que uma v2 recomece a contagem.
 */
export async function runAutoApprove(now = new Date()) {
  const due = await query<{ id: number; batch_id: number; current_version: number; client_name: string }>(
    `SELECT cr.id, cr.batch_id, cr.current_version, cl.name AS client_name
       FROM creatives cr
       JOIN batches b  ON b.id = cr.batch_id
       JOIN clients cl ON cl.id = b.client_id
       JOIN creative_versions v ON v.creative_id = cr.id AND v.version = cr.current_version
      WHERE cl.auto_approve_enabled = true
        AND cl.deleted_at IS NULL
        AND cr.status = 'pending'
        AND b.link_sent_at IS NOT NULL
        AND GREATEST(b.link_sent_at, v.created_at) + (cl.auto_approve_days || ' days')::interval <= $1`,
    [now],
  );

  const touched = new Set<number>();
  for (const c of due) {
    await tx(async (db) => {
      await query(
        `INSERT INTO decisions (creative_id, version, action, source, decided_at)
         VALUES ($1,$2,'approved','auto',$3) ON CONFLICT (creative_id, version) DO NOTHING`,
        [c.id, c.current_version, now], db,
      );
      await query(`UPDATE creatives SET status = 'auto_approved' WHERE id = $1 AND status = 'pending'`, [c.id], db);
      await logEvent({ batch_id: c.batch_id, creative_id: c.id, kind: 'creative_auto_approved', payload: { version: c.current_version } }, db);
      touched.add(c.batch_id);
    });
  }
  for (const batchId of touched) await recomputeBatchStatus(batchId, pool);
  return { autoApproved: due.length, batches: [...touched] };
}

export function scheduleAutoApprove() {
  cron.schedule(config.autoApproveCron, async () => {
    try {
      const r = await runAutoApprove();
      console.log(`[auto-aprovação] ${r.autoApproved} arte(s) auto-aprovada(s)`);
    } catch (e) {
      console.error('[auto-aprovação] erro', e);
    }
  }, { timezone: 'America/Sao_Paulo' });
}

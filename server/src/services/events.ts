import { query, type Queryable, pool } from '../db.js';

export type EventKind =
  | 'batch_created' | 'batch_archived' | 'batch_unarchived' | 'batch_deleted' | 'kanban_moved' | 'link_sent' | 'link_viewed' | 'batch_submitted'
  | 'creative_uploaded' | 'version_uploaded' | 'creative_edited'
  | 'creative_approved' | 'creative_rejected' | 'creative_auto_approved' | 'creative_decision_changed';

export async function logEvent(
  e: { batch_id: number; creative_id?: number | null; kind: EventKind; payload?: Record<string, unknown>; actor_id?: number | null },
  db: Queryable = pool,
) {
  await query(
    `INSERT INTO events (batch_id, creative_id, kind, payload, actor_id) VALUES ($1,$2,$3,$4,$5)`,
    [e.batch_id, e.creative_id ?? null, e.kind, JSON.stringify(e.payload ?? {}), e.actor_id ?? null],
    db,
  );
}

import { query, type Queryable, pool } from '../db.js';
import { assetUrls } from './uploads.js';

export interface CreativeRow {
  id: number; batch_id: number; type: string; caption: string; scheduled_date: string | null;
  status: string; current_version: number; sort_order: number; created_at: string;
  version_id: number; version_created_at: string; version_note: string | null;
  decision: null | { action: string; reason_category: string | null; comment: string | null; source: string; decided_at: string };
  versions_count: number;
}

/** Artes de um lote com os assets da versão vigente e a decisão dessa versão. */
export async function creativesOfBatch(batchId: number, db: Queryable = pool) {
  const rows = await query<CreativeRow>(
    `SELECT cr.*, v.id AS version_id, v.created_at AS version_created_at, v.note AS version_note,
            (SELECT count(*)::int FROM creative_versions WHERE creative_id = cr.id) AS versions_count,
            (SELECT row_to_json(d) FROM (
               SELECT action, reason_category, comment, source, decided_at
                 FROM decisions WHERE creative_id = cr.id AND version = cr.current_version) d) AS decision
       FROM creatives cr
       JOIN creative_versions v ON v.creative_id = cr.id AND v.version = cr.current_version
      WHERE cr.batch_id = $1
      ORDER BY cr.sort_order, cr.id`, [batchId], db,
  );
  if (!rows.length) return [];
  const assets = await query<{ id: number; version_id: number; file_key: string; thumb_key: string | null; mime: string; width: number | null; height: number | null; sort_order: number }>(
    `SELECT id, version_id, file_key, thumb_key, mime, width, height, sort_order
       FROM creative_assets WHERE version_id = ANY($1::int[]) ORDER BY sort_order, id`,
    [rows.map((r) => r.version_id)], db,
  );
  return rows.map((r) => ({ ...r, assets: assets.filter((a) => a.version_id === r.version_id).map(assetUrls) }));
}

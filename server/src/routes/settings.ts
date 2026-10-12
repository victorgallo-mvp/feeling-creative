import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { DEFAULT_TEMPLATE } from '../services/message.js';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

settingsRouter.get('/', async (_req, res) => {
  const rows = await query<{ key: string; value: string }>(`SELECT key, value FROM settings`);
  const out: Record<string, string> = { whatsapp_template: DEFAULT_TEMPLATE };
  for (const r of rows) out[r.key] = r.value;
  res.json(out);
});

settingsRouter.put('/', requireRole('gestor'), async (req, res) => {
  const b = z.record(z.string(), z.string()).parse(req.body);
  for (const [k, v] of Object.entries(b)) {
    await query(`INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [k, v]);
  }
  res.json({ ok: true });
});

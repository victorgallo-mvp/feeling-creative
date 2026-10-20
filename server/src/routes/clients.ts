import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { query, one } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { notFound, badRequest } from '../errors.js';
import { logoUpload, cleanupTmp } from '../services/uploads.js';
import { storage } from '../services/storage/index.js';
import { makeThumbnail } from '../services/thumbnails.js';
import { publicLink } from '../services/message.js';

export const clientsRouter = Router();
clientsRouter.use(requireAuth);

const SELECT = `
  SELECT c.*, d.name AS designer_name, m.name AS manager_name,
         (SELECT row_to_json(lb) FROM (
            SELECT b.id, b.month, b.year, b.title, b.link_token, b.link_sent_at, b.kanban_status,
                   (SELECT count(*)::int FROM creatives WHERE batch_id = b.id) AS total,
                   (SELECT count(*)::int FROM creatives WHERE batch_id = b.id AND status = 'pending') AS pending
              FROM batches b WHERE b.client_id = c.id AND b.link_token IS NOT NULL
             ORDER BY b.link_sent_at DESC NULLS LAST, b.id DESC LIMIT 1) lb) AS latest_batch
    FROM clients c
    LEFT JOIN users d ON d.id = c.designer_id
    LEFT JOIN users m ON m.id = c.manager_id`;

function withLogo<T extends { logo_key: string | null; latest_batch?: any }>(c: T) {
  const lb = c.latest_batch ? { ...c.latest_batch, link: publicLink(c.latest_batch.link_token) } : null;
  if (lb) delete lb.link_token;
  return { ...c, logo_url: c.logo_key ? storage.url(c.logo_key) : null, latest_batch: lb };
}

const schema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  instagram_handle: z.string().trim().transform((s) => s.replace(/^@/, "")).optional().nullable().or(z.literal("")),
  whatsapp: z.string().trim().optional().nullable().or(z.literal('')),
  designer_id: z.number().int().optional().nullable(),
  manager_id: z.number().int().optional().nullable(),
  auto_approve_enabled: z.boolean().optional(),
  auto_approve_days: z.number().int().min(1).max(60).optional(),
});

function normWhatsapp(v: string | null | undefined) {
  if (!v) return null;
  const digits = v.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length < 10 || digits.length > 15) throw badRequest('WhatsApp inválido. Use DDI+DDD+número, ex.: +55 31 99999-9999');
  return `+${digits.startsWith('55') || digits.length > 11 ? digits : '55' + digits}`;
}

clientsRouter.get('/', async (_req, res) => {
  const rows = await query(`${SELECT} WHERE c.deleted_at IS NULL ORDER BY c.name`);
  res.json(rows.map(withLogo));
});

clientsRouter.get('/:id', async (req, res) => {
  const c = await one(`${SELECT} WHERE c.id = $1 AND c.deleted_at IS NULL`, [req.params.id]);
  if (!c) throw notFound('Cliente não encontrado');
  res.json(withLogo(c));
});

clientsRouter.post('/', async (req, res) => {
  const b = schema.parse(req.body);
  const c = await one(
    `INSERT INTO clients (name, instagram_handle, whatsapp, designer_id, manager_id, auto_approve_enabled, auto_approve_days)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [b.name, b.instagram_handle || null, normWhatsapp(b.whatsapp), b.designer_id ?? null, b.manager_id ?? null, b.auto_approve_enabled ?? false, b.auto_approve_days ?? 7],
  );
  res.status(201).json(withLogo(c!));
});

clientsRouter.put('/:id', async (req, res) => {
  const b = schema.parse(req.body);
  const c = await one(
    `UPDATE clients SET name=$2, instagram_handle=$3, whatsapp=$4, designer_id=$5, manager_id=$6, auto_approve_enabled=$7, auto_approve_days=$8
      WHERE id=$1 AND deleted_at IS NULL RETURNING *`,
    [req.params.id, b.name, b.instagram_handle || null, normWhatsapp(b.whatsapp), b.designer_id ?? null, b.manager_id ?? null, b.auto_approve_enabled ?? false, b.auto_approve_days ?? 7],
  );
  if (!c) throw notFound('Cliente não encontrado');
  res.json(withLogo(c));
});

clientsRouter.post('/:id/logo', logoUpload.single('logo'), async (req, res) => {
  const file = req.file;
  if (!file) throw badRequest('Envie uma imagem JPG, PNG ou WebP');
  try {
    const id = z.coerce.number().int().parse(req.params.id);
    const exists = await one(`SELECT logo_key FROM clients WHERE id = $1 AND deleted_at IS NULL`, [id]);
    if (!exists) throw notFound('Cliente não encontrado');
    const key = `clients/${id}/logo_${crypto.randomUUID().slice(0, 8)}.webp`;
    await makeThumbnail(file.path, key);
    const c = await one(`UPDATE clients SET logo_key=$2 WHERE id=$1 RETURNING *`, [id, key]);
    if (exists.logo_key && exists.logo_key !== key) await storage.delete(exists.logo_key);
    res.json(withLogo(c!));
  } finally {
    await cleanupTmp([file]);
  }
});

clientsRouter.delete('/:id', async (req, res) => {
  await query(`UPDATE clients SET deleted_at = now() WHERE id = $1`, [req.params.id]);
  res.status(204).end();
});

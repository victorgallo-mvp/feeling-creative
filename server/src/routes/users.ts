import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query, one } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../errors.js';

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get('/', async (_req, res) => {
  res.json(await query(`SELECT id, name, email, role, created_at FROM users ORDER BY name`));
});

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6, 'Senha precisa de ao menos 6 caracteres'),
  role: z.enum(['designer', 'gestor']),
});

usersRouter.post('/', requireRole('gestor'), async (req, res) => {
  const b = userSchema.parse(req.body);
  const exists = await one(`SELECT 1 FROM users WHERE email = $1`, [b.email]);
  if (exists) throw new HttpError(409, 'Já existe usuário com esse e-mail');
  const hash = await bcrypt.hash(b.password, 10);
  const u = await one(`INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role`, [b.name, b.email, hash, b.role]);
  res.status(201).json(u);
});

usersRouter.put('/:id', requireRole('gestor'), async (req, res) => {
  const b = userSchema.partial().parse(req.body);
  const id = Number(req.params.id);
  const cur = await one(`SELECT * FROM users WHERE id = $1`, [id]);
  if (!cur) throw new HttpError(404, 'Usuário não encontrado');
  const hash = b.password ? await bcrypt.hash(b.password, 10) : cur.password_hash;
  const u = await one(
    `UPDATE users SET name=$2, email=$3, password_hash=$4, role=$5 WHERE id=$1 RETURNING id, name, email, role`,
    [id, b.name ?? cur.name, b.email ?? cur.email, hash, b.role ?? cur.role],
  );
  res.json(u);
});

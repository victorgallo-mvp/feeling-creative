import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { one } from '../db.js';
import { HttpError } from '../errors.js';
import { requireAuth, signToken, type AuthUser } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const u = await one(`SELECT id, name, email, role, password_hash FROM users WHERE email = $1`, [body.email]);
  if (!u || !(await bcrypt.compare(body.password, u.password_hash))) throw new HttpError(401, 'E-mail ou senha incorretos');
  const user: AuthUser = { id: u.id, name: u.name, email: u.email, role: u.role };
  res.json({ token: signToken(user), user });
});

authRouter.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

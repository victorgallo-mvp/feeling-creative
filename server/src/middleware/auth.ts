import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError } from '../errors.js';

export type Role = 'designer' | 'gestor';
export interface AuthUser { id: number; name: string; email: string; role: Role }

declare global {
  namespace Express {
    interface Request { user?: AuthUser }
  }
}

export function signToken(user: AuthUser) {
  return jwt.sign(user, config.jwtSecret, { expiresIn: '30d' });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Faça login para continuar'));
  try {
    req.user = jwt.verify(token, config.jwtSecret) as AuthUser;
    next();
  } catch {
    next(new HttpError(401, 'Sessão expirada, faça login novamente'));
  }
}

export function requireRole(role: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.user?.role !== role) return next(new HttpError(403, 'Apenas gestores podem fazer isso'));
    next();
  };
}

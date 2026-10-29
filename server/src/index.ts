import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { ZodError } from 'zod';
import { config } from './config.js';
import { HttpError } from './errors.js';
import { storageRoot } from './services/storage/index.js';
import { scheduleAutoApprove } from './services/autoApprove.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { clientsRouter } from './routes/clients.js';
import { batchesRouter } from './routes/batches.js';
import { creativesRouter } from './routes/creatives.js';
import { notificationsRouter } from './routes/notifications.js';
import { settingsRouter } from './routes/settings.js';
import { feedbacksRouter } from './routes/feedbacks.js';
import { alertsRouter, activityRouter } from './routes/activity.js';
import { publicRouter } from './routes/public.js';

const app = express();
app.set('trust proxy', 1);

const allowed = new Set([config.frontendUrl, 'http://localhost:5173', 'http://127.0.0.1:5173']);
app.use(cors({ origin: (origin, cb) => cb(null, !origin || allowed.has(origin)), credentials: false }));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

// Arquivos enviados (originais e thumbs). Chaves usam UUID, então não são adivinháveis.
app.use('/files', express.static(storageRoot, { maxAge: '30d', immutable: true, index: false, dotfiles: 'deny' }));

app.use('/api/a', publicRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/batches', batchesRouter);
app.use('/api', creativesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/feedbacks', feedbacksRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/activity', activityRouter);


app.use((_req, res) => res.status(404).json({ error: 'Rota não encontrada' }));

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: err.issues.map((i) => `${i.path.join('.') || 'campo'}: ${i.message}`).join('; ') });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `Arquivo acima do limite de ${config.maxUploadBytes / 1024 / 1024} MB` });
  console.error(err);
  res.status(500).json({ error: 'Erro interno. Tente novamente.' });
});

app.listen(config.port, "0.0.0.0", () => {
  console.log(`API em ${config.apiUrl} (porta ${config.port}) · uploads em ${path.resolve(storageRoot)}`);
  scheduleAutoApprove();
  console.log(`Job de auto-aprovação agendado: "${config.autoApproveCron}" (America/Sao_Paulo)`);
});

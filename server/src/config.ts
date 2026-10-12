import 'dotenv/config';

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  return v;
}

export const config = {
  databaseUrl: req('DATABASE_URL'),
  jwtSecret: req('JWT_SECRET'),
  port: Number(process.env.PORT || 3001),
  apiUrl: (process.env.API_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/$/, ''),
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, ''),
  storagePath: process.env.STORAGE_PATH || './uploads',
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB || 200) * 1024 * 1024,
  autoApproveCron: process.env.AUTO_APPROVE_CRON || '0 9 * * *',
  stuckDays: Number(process.env.KANBAN_STUCK_DAYS || 3),
  isProd: process.env.NODE_ENV === 'production',
};

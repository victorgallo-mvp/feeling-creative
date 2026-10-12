/**
 * Seed: 1 gestor (admin) sempre. Em desenvolvimento também 1 designer, 2 clientes e
 * 1 lote do mês atual com 8 artes placeholder (imagens geradas via sharp).
 * Idempotente: não duplica se o admin já existir. Roda no start do serviço.
 */
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pool, query, one, tx } from './db.js';
import { attachAssets } from './services/uploads.js';
import { logEvent } from './services/events.js';
import { tmpDir } from './services/storage/index.js';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@feeling.com.br';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'feeling123';
// Em produção (NODE_ENV=production) o seed cria só o admin. SEED_EXAMPLES=true força os exemplos.
const EXAMPLES = process.env.SEED_EXAMPLES ? process.env.SEED_EXAMPLES === 'true' : process.env.NODE_ENV !== 'production';

const PALETTE = ['#f97316', '#0ea5e9', '#22c55e', '#a855f7', '#ef4444', '#eab308', '#14b8a6', '#ec4899'];

async function placeholder(i: number, label: string, w = 1080, h = 1350) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${PALETTE[i % PALETTE.length]}"/><stop offset="1" stop-color="#111827"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="50%" y="48%" font-family="Helvetica, Arial" font-size="120" font-weight="700" fill="white" text-anchor="middle">${label}</text>
    <text x="50%" y="58%" font-family="Helvetica, Arial" font-size="48" fill="rgba(255,255,255,.8)" text-anchor="middle">placeholder · Feeling</text>
  </svg>`;
  const p = path.join(tmpDir, `seed_${i}_${Date.now()}.jpg`);
  await fs.mkdir(tmpDir, { recursive: true });
  await sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toFile(p);
  const st = await fs.stat(p);
  return { path: p, mimetype: 'image/jpeg', size: st.size, originalname: `arte-${i + 1}.jpg` };
}

async function main() {
  const existing = await one(`SELECT id FROM users WHERE email = $1`, [ADMIN_EMAIL]);
  if (existing) {
    console.log('Seed já aplicado (admin existe). Nada a fazer.');
    return;
  }
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const admin = await one(`INSERT INTO users (name, email, password_hash, role) VALUES ('Admin Feeling', $1, $2, 'gestor') RETURNING id`, [ADMIN_EMAIL, hash]);
  if (!EXAMPLES) {
    console.log(`Seed mínimo ok: admin ${ADMIN_EMAIL} criado (sem dados de exemplo).`);
    return;
  }
  const designer = await one(`INSERT INTO users (name, email, password_hash, role) VALUES ('Designer Exemplo', 'designer@feeling.com.br', $1, 'designer') RETURNING id`, [hash]);

  const c1 = await one(
    `INSERT INTO clients (name, instagram_handle, whatsapp, designer_id, manager_id) VALUES ('Sport Fitness', 'sportfitness', '+5531999990000', $1, $2) RETURNING id`,
    [designer!.id, admin!.id]);
  await one(
    `INSERT INTO clients (name, instagram_handle, whatsapp, designer_id, manager_id) VALUES ('Clínica Bem Estar', 'clinicabemestar', '+5531988880000', $1, $2) RETURNING id`,
    [designer!.id, admin!.id]);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const batch = await one(`INSERT INTO batches (client_id, month, year, kanban_status) VALUES ($1,$2,$3,'em_producao') RETURNING id`, [c1!.id, month, year]);
  await logEvent({ batch_id: batch!.id, kind: 'batch_created', actor_id: admin!.id });

  const captions = [
    'Comece a semana com energia! 💪 Treino de pernas hoje às 18h. #SportFitness',
    'Dica do personal: hidratação é 50% do resultado. Bora beber água? 💧',
    'Novo horário de spinning às terças e quintas. Garanta sua vaga! 🚴',
    'Antes e depois da Ana: 6 meses de dedicação. Orgulho demais! 🔥',
    'Promoção de outubro: traga um amigo e ganhe 1 mês. Válido até o dia 31.',
    'Alongamento pós-treino evita lesões. Confira 3 exercícios no carrossel ➡️',
    'Stories: bastidores da aula de funcional de hoje!',
    'Sexta é dia de treino em dupla. Marca aquele parceiro de academia 👇',
  ];
  const types = ['estatica', 'estatica', 'estatica', 'video', 'estatica', 'carrossel', 'story', 'estatica'] as const;

  for (let i = 0; i < 8; i++) {
    const date = new Date(year, month - 1, 3 + i * 3).toISOString().slice(0, 10);
    const type = types[i];
    const files = type === 'carrossel'
      ? [await placeholder(i, 'Arte 6 · 1/3'), await placeholder(i + 1, 'Arte 6 · 2/3'), await placeholder(i + 2, 'Arte 6 · 3/3')]
      : [await placeholder(i, `Arte ${i + 1}`, type === 'story' ? 1080 : 1080, type === 'story' ? 1920 : 1350)];
    // vídeo placeholder: no seed usamos imagem estática mesmo, marcada como 'estatica'
    const effType = type === 'video' ? 'estatica' : type;
    await tx(async (db) => {
      const cr = await one(`INSERT INTO creatives (batch_id, type, caption, scheduled_date, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [batch!.id, effType, captions[i], date, i + 1], db);
      const v = await one(`INSERT INTO creative_versions (creative_id, version, created_by) VALUES ($1,1,$2) RETURNING id`, [cr!.id, designer!.id], db);
      await attachAssets(files, batch!.id, v!.id, db);
      await logEvent({ batch_id: batch!.id, creative_id: cr!.id, kind: 'creative_uploaded', payload: { type: effType, files: files.length }, actor_id: designer!.id }, db);
    });
  }
  console.log(`Seed ok. Login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD} (gestor) · designer@feeling.com.br / ${ADMIN_PASSWORD} (designer)`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => pool.end());

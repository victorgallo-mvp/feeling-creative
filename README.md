# Feeling · Aprovação de criativos (MVP)

Sistema da agência Feeling para gerenciar a produção mensal de conteúdo de Instagram e colher a aprovação dos clientes por um link sem login, com swipe estilo Tinder. Roda sob a Potentia.

- **Painel interno** (`/app`): login, clientes, lotes por mês, upload em lote, Kanban, link + mensagem de WhatsApp, fila de recusas, histórico por arte.
- **Link do cliente** (`/a/:token`): mobile-first, card imitando post do Instagram, swipe direita aprova, esquerda abre modal de recusa, prévia da grade do feed, resumo e envio.

## Stack

| Parte | Tecnologia | Deploy |
|---|---|---|
| `server/` | Node 20+, Express 5, PostgreSQL (`pg`), migrations SQL com `node-pg-migrate`, `sharp` (thumbs WebP), `node-cron` | Railway (+ plugin Postgres + volume) |
| `web/` | React 19, Vite, Tailwind v4, Framer Motion, TanStack Query, React Router | Vercel |

Monorepo com npm workspaces. Auth por JWT (Bearer) porque front e API ficam em domínios diferentes.

## Rodando localmente

Pré-requisitos: Node 20+, PostgreSQL local.

```bash
createdb feeling_aprovacao
npm install
cp server/.env.example server/.env   # ajuste DATABASE_URL se precisar
cp web/.env.example web/.env         # VITE_API_URL=http://localhost:3001
npm run migrate                      # cria as tabelas
npm run seed                         # admin + designer + 2 clientes + lote com 8 artes
npm run dev                          # API em :3001, front em :5173
```

Login do seed: `admin@feeling.com.br` / `feeling123` (gestor) e `designer@feeling.com.br` / `feeling123` (designer).

Scripts úteis: `npm run migrate -w server` / `npm run migrate:down -w server`, `npm run build`, `npm run seed`.

## Deploy

### API no Railway

1. Novo projeto a partir do repositório. Deixe o **root directory vazio** (raiz do monorepo): o `railway.json` já define build (`npm run build -w server`) e start (`npm run start -w server`, que roda as migrations antes de subir).
2. Adicione o plugin **PostgreSQL**; ele injeta `DATABASE_URL`.
3. Adicione um **Volume** montado em `/data` e defina `STORAGE_PATH=/data`.
4. Variáveis:
   - `JWT_SECRET` (`openssl rand -hex 32`)
   - `API_URL` = URL pública do serviço (ex.: `https://feeling-api.up.railway.app`)
   - `FRONTEND_URL` = URL do front na Vercel (usada no link do cliente e no CORS)
   - `STORAGE_PATH=/data`, `MAX_UPLOAD_MB=200`, `AUTO_APPROVE_CRON=0 9 * * *`
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD` para o seed
5. Depois do primeiro deploy, rode o seed uma vez: `railway run npm run seed` (ou pelo shell do serviço). Em produção o seed cria também os dois clientes de exemplo; apague-os pelo painel se não quiser.

### Front na Vercel

1. Importe o repositório e defina **Root Directory = `web`**. Framework: Vite. Build `npm run build`, output `dist`.
2. Variável `VITE_API_URL` = URL da API no Railway.
3. O `web/vercel.json` já reescreve todas as rotas para `index.html` (SPA), então `/a/:token` funciona.

Depois que a Vercel der o domínio, volte no Railway e preencha `FRONTEND_URL`.

## Como funciona

### Fluxo

1. Designer cria o cliente (nome, @, WhatsApp, responsáveis) e o lote do mês.
2. No lote, arrasta os arquivos: cada arquivo vira uma arte (ou usa **+ Carrossel** para várias imagens em uma arte). Preenche legenda, tipo e data prevista em cada card.
3. Gestor clica **Gerar link + mensagem**: o sistema cria o token, monta a mensagem (template em Configurações, com `{cliente}` `{link}` `{qtd_artes}`) e abre o WhatsApp via `wa.me`. O lote vai para **Enviado para aprovação**.
4. Cliente abre o link no celular, desliza cada card (direita aprova, esquerda abre motivo + comentário), vê a grade do feed e envia. Cada swipe é salvo na hora; se ficar sem rede, a resposta fica guardada no navegador e é reenviada na próxima abertura.
5. Recusas aparecem em **Recusas** no painel. O designer sobe a v2 na arte; ela volta a pendente e o mesmo link passa a mostrar só o que está pendente.
6. Quando 100% das artes vigentes estão aprovadas, o lote vai sozinho para **Aprovado**; o gestor move para **Programado** manualmente.

### Kanban

`Briefing`, `Em produção` e `Programado` são manuais (arrastar). `Enviado para aprovação` e `Aprovado` são automáticos. Cartão em aprovação há mais de `KANBAN_STUCK_DAYS` (3) dias fica marcado em vermelho.

### Auto-aprovação

Estrutura pronta, **desligada por padrão** (`auto_approve_enabled = false` em cada cliente). O job (`AUTO_APPROVE_CRON`, fuso America/Sao_Paulo) marca como `auto_approved` as artes pendentes de clientes com a opção ligada quando `max(envio do link, criação da versão vigente) + auto_approve_days` já passou, registra `decisions(source='auto')` e o evento `creative_auto_approved`.

### Storage

`server/src/services/storage/index.ts` expõe `saveBuffer / saveFromPath / readBuffer / delete / url`. O driver atual grava em disco (`STORAGE_PATH`) e serve em `/files/*`. Para S3 ou Google Drive (fase 2) basta implementar outro driver.

## API (resumo)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/login` | `{email, password}` → `{token, user}` |
| GET/POST/PUT | `/api/users` | equipe (criação só gestor) |
| GET/POST/PUT/DELETE | `/api/clients[/:id]` · POST `/:id/logo` | clientes |
| GET/POST | `/api/batches` · GET/DELETE `/:id` · PATCH `/:id/kanban` · POST `/:id/link` | lotes, Kanban, link + mensagem |
| POST | `/api/batches/:id/creatives` (multipart `files[]`, `mode=each|single`) | upload |
| PUT/DELETE | `/api/creatives/:id` · PUT `/assets/order` · POST `/versions` · GET `/timeline` | artes, versões, auditoria |
| GET/POST | `/api/notifications[/count|/:id/read|/read-all]` | recusas |
| GET/PUT | `/api/settings` | template da mensagem |
| GET | `/api/a/:token` · POST `/decisions` · POST `/submit` | link do cliente (sem auth) |

## Fora do escopo do MVP

Google Drive/Sheets, envio automático de mensagens, dashboard de métricas, conversão de formatos, API do Instagram, multi-tenant. Vídeos não têm frame extraído (precisaria de ffmpeg); o preview usa o próprio `<video>`.

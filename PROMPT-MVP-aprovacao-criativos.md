# Prompt — MVP Sistema de Aprovação de Criativos (Feeling)

> Como usar: salve este arquivo na raiz de uma pasta vazia do projeto e rode o Claude Code com:
> "Leia PROMPT-MVP-aprovacao-criativos.md e implemente o MVP descrito, começando pelo scaffold e modelo de dados. Antes de codar, me apresente a estrutura de pastas e o schema para eu aprovar."

---

## Contexto

A Feeling é uma agência de marketing (~15 pessoas) que produz conteúdo mensal de Instagram para ~25 clientes. Hoje o fluxo é: planilha de Excel por mês (clientes nas linhas, colunas de artes/vídeos/status), cronograma de artes em links do Canva, e aprovação do cliente feita informalmente por WhatsApp, anotada como "OK" na planilha. Problemas: nada é fonte de verdade, cobrança de aprovação é manual, não há histórico nem métrica.

Este sistema substitui esse fluxo. **O sistema é a fonte de verdade** das demandas de produção e das aprovações. Dois públicos:

1. **Equipe Feeling** (designers e gestores) — painel interno com login.
2. **Cliente final da agência** — recebe um link único por lote, **sem login**, mobile-first, onde aprova/recusa cada arte com swipe (estilo Tinder).

O projeto roda sob a Potentia (empresa do Victor). Stack preferida do Victor: Node.js + Express, React, PostgreSQL, Railway. Referência de mecânica de swipe: componentes de carousel/cards com Framer Motion (como os do 21st.dev).

## Decisões de produto (já fechadas com o cliente — não questionar, implementar)

- Aprovação é **por arte individual**, não por lote inteiro.
- Card do cliente imita **post do Instagram**: arte + legenda juntas; aprovar o card aprova os dois.
- Swipe **direita = aprovar**; swipe **esquerda = abre modal de recusa** com motivos pré-definidos (Texto/legenda, Identidade visual, Imagem, Outro) + campo de comentário livre. Também deve haver botões de aprovar/recusar para quem não quiser arrastar.
- **Preview da grade do feed**: mock, grid de 3 colunas, artes do lote ordenadas por data prevista de postagem (mais recente no topo). Sem integração com API do Instagram.
- **Sem cobrança automática**: o painel gera uma **mensagem pré-pronta** (texto padrão + link do lote) com botão que abre `https://wa.me/<numero>?text=<mensagem urlencoded>` direto na conversa do cliente. Gestor dispara com 1 clique.
- **Auto-aprovação**: implementar a estrutura (campo `auto_approve_days` por cliente, default 7, contado a partir do envio do link/upload; job diário que marca artes pendentes como auto-aprovadas e registra no audit log), porém **desligada por padrão** (`auto_approve_enabled = false`). Não ativar para nenhum cliente.
- **Versionamento**: arte recusada pode receber nova versão (v2, v3…). O cliente vê apenas a versão vigente; histórico fica preservado e visível no painel interno.
- **Kanban** no painel interno para acompanhar demandas do mês.
- Notificações de recusa aparecem **no painel** (sem e-mail/WhatsApp automático no MVP).
- Google Drive, espelho em Google Sheets e conversão de formatos de imagem são **fase 2 — NÃO implementar agora**. Armazenamento no MVP: disco/volume do Railway ou S3-compatível (abstrair atrás de um service de storage para trocar depois).

## Escopo do MVP (Fase 1)

### Painel interno (`/app`)
- Auth simples: e-mail/senha (bcrypt + JWT ou sessão), perfis `designer` e `gestor`. Seed com 1 usuário admin.
- **Clientes**: CRUD — nome, logo, @ do Instagram (texto), WhatsApp de contato (E.164), designer responsável, gestor responsável, `auto_approve_enabled` (bool, default false), `auto_approve_days` (int, default 7).
- **Lotes** (batch): um por cliente+mês (ex.: "SPORT FITNESS — Outubro/2026"). Status derivado das artes.
- **Upload em lote**: drag & drop de múltiplos arquivos (imagem jpg/png/webp e vídeo mp4) dentro de um lote; para cada arte, campos: legenda (textarea), tipo (`estatica | carrossel | story | video`), data prevista de postagem (date). Carrossel: múltiplas imagens em uma arte, ordenáveis.
- **Kanban do mês**: colunas `Briefing → Em produção → Enviado para aprovação → Aprovado → Programado`. Cartão = cliente, mostrando progresso (ex.: "6/8 aprovadas"), designer/gestor, alerta visual se lote parado há mais de X dias (X=3) na coluna de aprovação. Drag & drop entre colunas para os status manuais (Briefing/Em produção/Programado); "Enviado para aprovação" e "Aprovado" mudam automaticamente (envio do link / 100% das artes decididas).
- **Envio**: botão "Gerar link + mensagem" no lote → cria/rotaciona token do link público, monta mensagem padrão (template editável nas configurações, placeholders `{cliente}` `{link}` `{qtd_artes}`) e mostra botão "Abrir WhatsApp" (wa.me) + "Copiar mensagem".
- **Recusas**: fila de notificações no painel (arte X do cliente Y recusada — motivo); na arte recusada, botão "Subir nova versão" (upload da v2 → status volta a pendente no link do cliente).
- **Auditoria**: timeline por arte (enviada, visualizada pelo cliente, aprovada/recusada/auto-aprovada, nova versão) com timestamp.

### Link do cliente (`/a/:token`)
- Sem login; token ≥ 24 chars aleatórios, única credencial. Página 100% mobile-first (funciona bem também em desktop).
- Tela inicial: logo/nome do cliente, "X artes para aprovar", botão começar.
- **Stack de cards swipáveis** (Framer Motion): card = mock de post do Instagram (header com avatar/@, imagem — carrossel deslizável se for o caso, vídeo com player inline — e legenda com "ver mais"). Swipe direita aprova (feedback verde), esquerda abre modal de recusa (motivos + comentário, confirmar/cancelar — cancelar devolve o card). Botões ✓/✗ fixos no rodapé como alternativa ao gesto.
- **Preview da grade**: aba/toggle "Ver feed" → grid 3 colunas com as artes do lote ordenadas por data prevista de postagem desc. Artes de story não entram na grade. (Estrutura preparada para, no futuro, intercalar posts antigos subidos pelo designer.)
- Tela final: resumo (X aprovadas, Y recusadas), botão "Enviar aprovação" → persiste decisões pendentes e mostra confirmação. Decisões também são salvas incrementalmente a cada swipe (não perder progresso se fechar o navegador).
- Registrar `viewed_at` na primeira abertura do link (alimenta auditoria e a futura régua).
- Se reaberto depois: mostra só artes ainda pendentes (incluindo novas versões); se nada pendente, tela de "tudo aprovado" com a grade.

### Modelo de dados (PostgreSQL — ajuste fino livre, manter conceitos)
- `users` (id, name, email, password_hash, role)
- `clients` (id, name, logo_url, instagram_handle, whatsapp, designer_id, manager_id, auto_approve_enabled, auto_approve_days)
- `batches` (id, client_id, month, year, kanban_status, link_token, link_sent_at, viewed_at)
- `creatives` (id, batch_id, type, caption, scheduled_date, status: `pending|approved|rejected|auto_approved`, current_version, sort_order)
- `creative_versions` (id, creative_id, version, created_at) + `creative_assets` (id, version_id, file_url, mime, sort_order) — carrossel = múltiplos assets
- `decisions` (id, creative_id, version, action: `approved|rejected`, reason_category, comment, decided_at, source: `client|auto`)
- `events` (id, batch_id, creative_id?, kind, payload jsonb, created_at) — auditoria
- `settings` (key, value) — template da mensagem etc.

### Stack e estrutura
- Monorepo simples: `/server` (Express + pg, migrations com node-pg-migrate ou Prisma — escolher e justificar) e `/web` (React + Vite + Tailwind + Framer Motion). Servir o build do front pelo Express em produção (deploy único no Railway) ou dois serviços — escolher o mais simples e documentar.
- Upload: service de storage abstraído (interface `saveFile/getUrl/delete`) com driver local/volume agora; gerar thumbnails WebP (sharp) para o link do cliente e para a grade.
- Variáveis de ambiente documentadas em `.env.example` (DATABASE_URL, JWT_SECRET, BASE_URL, STORAGE_PATH…).
- Job diário (node-cron) da auto-aprovação já implementado, respeitando `auto_approve_enabled`.
- Seed de desenvolvimento: 1 admin, 2 clientes de exemplo, 1 lote com 8 artes placeholder.
- Idioma de toda a UI: **português (Brasil)**. Tom simples, sem jargão técnico para o cliente final.

### Critérios de aceite do MVP
1. Designer cria cliente, cria lote de outubro, sobe 8 artes com legenda e datas em menos de 3 minutos.
2. Gestor gera link + mensagem e abre a conversa do WhatsApp com o texto pronto.
3. No celular, o cliente abre o link, aprova 6 artes por swipe, recusa 2 com motivo, vê a grade do feed e envia.
4. No painel, as recusas aparecem como notificação; designer sobe v2 de uma arte; o link do cliente passa a mostrar só a v2 pendente.
5. Kanban reflete os status automaticamente; auditoria mostra a timeline completa de uma arte.
6. Job de auto-aprovação roda sem efeito enquanto `auto_approve_enabled = false`.

### Fora do escopo (NÃO fazer agora)
Integração Google Drive/Sheets, envio automático de mensagens, métricas/dashboard, conversão de formatos de imagem, integração com API do Instagram, multi-tenancy além da Feeling.

## Como conduzir o trabalho
1. Apresente estrutura de pastas + schema de banco e aguarde aprovação.
2. Scaffold + migrations + seed.
3. API + auth + CRUD clientes/lotes/upload.
4. Painel interno (upload e kanban primeiro, notificações depois).
5. Link do cliente (swipe → modal → grade → resumo).
6. Auditoria + job de auto-aprovação.
7. Checklist final contra os critérios de aceite + README com setup e deploy no Railway.

Em cada etapa, rode e teste localmente antes de seguir. Commits pequenos e descritivos.

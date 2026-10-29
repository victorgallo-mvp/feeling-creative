import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, ApiError } from '../api/client';
import type { PublicBatch, PublicCreative, RejectReason } from '../api/types';
import { Avatar, Logo, Spinner, Stars } from '../components/ui';
import { MONTHS } from '../lib/format';
import { SwipeStack } from './SwipeStack';
import { FeedGrid } from './FeedGrid';
import { PostCard } from './PostCard';
import { RejectSheet } from './RejectSheet';
import { REASON_LABEL } from '../lib/format';
import { toast } from '../components/toastStore';

type Decision = { creative_id: number; version: number; action: 'approved' | 'rejected'; reason_category?: RejectReason | null; comment?: string | null };
type Stage = 'start' | 'swipe' | 'done';

const BTN = 'w-full rounded-xl bg-brand-500 py-3.5 text-base font-semibold text-black transition active:scale-[0.98] disabled:opacity-50';

export function ApprovePage() {
  const { token = '' } = useParams();
  const [data, setData] = useState<PublicBatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('start');
  const [tab, setTab] = useState<'aprovar' | 'feed'>('aprovar');
  const [preview, setPreview] = useState<PublicCreative | null>(null);
  const [changing, setChanging] = useState(false); // modal de motivo ao trocar para recusa na prévia
  const [changeBusy, setChangeBusy] = useState(false);
  const [changeMin, setChangeMin] = useState(false); // folha de recusa minimizada na prévia
  const [changeSheetH, setChangeSheetH] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [session, setSession] = useState({ approved: 0, rejected: 0 });
  // feedback obrigatório no envio: nota 1–5 + uma frase
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const queueKey = `feeling_queue_${token}`;

  const load = useCallback(async () => {
    try {
      // reenvia decisões que ficaram presas offline; só sai da fila o que o servidor aceitou
      // (ou recusou de forma definitiva, 4xx). Erro de rede mantém na fila para a próxima abertura.
      const queued: Decision[] = JSON.parse(localStorage.getItem(queueKey) || '[]');
      const remaining: Decision[] = [];
      for (const d of queued) {
        try { await api.post(`/api/a/${token}/decisions`, d, { auth: false }); }
        catch (e) { if (!(e instanceof ApiError)) remaining.push(d); }
      }
      if (remaining.length) localStorage.setItem(queueKey, JSON.stringify(remaining)); else localStorage.removeItem(queueKey);
      const r = await api.get<PublicBatch>(`/api/a/${token}`, { auth: false });
      setData(r);
      setSubmitted(!!r.batch.submitted_at);
      if (r.batch.feedback) { setRating(r.batch.feedback.rating); setComment(r.batch.feedback.comment ?? ''); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Link inválido'); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const pending = useMemo(() => data?.creatives.filter((c) => c.status === 'pending') ?? [], [data]);
  const counts = useMemo(() => ({
    approved: data?.creatives.filter((c) => c.status === 'approved' || c.status === 'auto_approved').length ?? 0,
    rejected: data?.creatives.filter((c) => c.status === 'rejected').length ?? 0,
  }), [data]);

  const decide = async (c: PublicCreative, action: 'approved' | 'rejected', reason?: RejectReason, comment?: string) => {
    const d: Decision = { creative_id: c.id, version: c.version, action, reason_category: reason ?? null, comment: comment ?? null };
    // atualiza local primeiro (não perde progresso), depois persiste
    setData((cur) => cur && { ...cur, creatives: cur.creatives.map((x) => x.id === c.id ? { ...x, status: action, decision: { action, reason_category: reason ?? null, comment: comment ?? null, source: 'client', decided_at: new Date().toISOString() } } : x) });
    setSession((s) => ({ ...s, [action]: s[action] + 1 }));
    try {
      await api.post(`/api/a/${token}/decisions`, d, { auth: false });
    } catch (e) {
      if (e instanceof ApiError) {
        // resposta definitiva do servidor (versão nova, arte removida, link trocado): avisa e recarrega
        toast(e.message, 'error');
        load();
        return;
      }
      const q: Decision[] = JSON.parse(localStorage.getItem(queueKey) || '[]');
      localStorage.setItem(queueKey, JSON.stringify([...q, d]));
      toast('Sem conexão: sua resposta foi guardada e será enviada depois');
    }
  };

  useEffect(() => { if (stage === 'swipe' && pending.length === 0) setStage('done'); }, [stage, pending.length]);

  // Pode trocar a resposta enquanto ela não foi enviada à agência (lote nunca enviado, ou decisão posterior ao último envio).
  const canChange = (c: PublicCreative) => c.status !== 'pending' && !!c.decision && c.decision.source === 'client'
    && (!data?.batch.submitted_at || new Date(c.decision.decided_at) > new Date(data.batch.submitted_at));

  const change = async (c: PublicCreative, action: 'approved' | 'rejected', reason?: RejectReason, comment?: string) => {
    setChangeBusy(true);
    try {
      await api.put(`/api/a/${token}/decisions/${c.id}`, { version: c.version, action, reason_category: reason ?? null, comment: comment ?? null }, { auth: false });
      const decision = { action, reason_category: reason ?? null, comment: comment ?? null, source: 'client' as const, decided_at: new Date().toISOString() };
      setData((cur) => cur && { ...cur, creatives: cur.creatives.map((x) => x.id === c.id ? { ...x, status: action, decision } : x) });
      setPreview((p) => p && p.id === c.id ? { ...p, status: action, decision } : p);
      setSession((s) => ({ ...s, [action]: s[action] + 1 }));
      setChanging(false);
      toast(action === 'approved' ? 'Arte aprovada' : 'Pedido de ajuste registrado');
    } catch (e) { toast(e instanceof Error ? e.message : 'Não foi possível alterar', 'error'); if (e instanceof ApiError) load(); }
    finally { setChangeBusy(false); }
  };

  const canSubmit = rating >= 1 && comment.trim().length >= 3;
  const submit = async () => {
    if (!canSubmit) { toast(rating < 1 ? 'Avalie de 1 a 5 estrelas' : 'Escreva uma frase sobre a experiência', 'error'); return; }
    setSending(true);
    try {
      await api.post(`/api/a/${token}/submit`, { rating, comment: comment.trim() }, { auth: false });
      setSubmitted(true);
      setSession({ approved: 0, rejected: 0 });
      toast('Aprovação enviada. Obrigado!');
    }
    catch (e) { toast(e instanceof Error ? e.message : 'Erro ao enviar', 'error'); }
    finally { setSending(false); }
  };

  if (error) return <Shell><div className="m-auto max-w-sm p-6 text-center"><Logo on="dark" className="mx-auto mb-6 h-10" /><h1 className="display text-3xl">Link indisponível</h1><p className="mt-2 text-sm text-neutral-400">{error}</p></div></Shell>;
  if (!data) return <Shell><div className="m-auto"><Spinner className="border-neutral-700 border-t-brand-500" /></div></Shell>;

  const { client, batch } = data;
  const monthName = `${MONTHS[batch.month - 1]} de ${batch.year}`;
  const allDone = pending.length === 0;
  // já enviou e não respondeu nada de novo desde então → só mostra o agradecimento
  const alreadySent = submitted && session.approved + session.rejected === 0;

  return (
    <Shell>
      <header className="flex items-center gap-3 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-2">
        <Avatar src={client.logo_url} name={client.name} size={36} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate font-semibold">{client.name}</div>
          <div className="truncate text-xs text-neutral-400">{batch.title ? `${batch.title} · ${monthName}` : `Conteúdo de ${monthName}`}</div>
        </div>
        <div className="flex rounded-full bg-white/10 p-0.5 text-xs font-medium">
          {(['aprovar', 'feed'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1.5 transition ${tab === t ? 'bg-brand-500 text-black' : 'text-neutral-300'}`}>{t === 'aprovar' ? 'Aprovar' : 'Ver feed'}</button>
          ))}
        </div>
      </header>

      {tab === 'feed' ? (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-2 text-xs text-neutral-400">Prévia de como o feed vai ficar, da data mais recente para a mais antiga. Toque para ver o post.</div>
          <StoriesRow creatives={data.creatives} onOpen={setPreview} />
          <FeedGrid creatives={data.creatives} onOpen={setPreview} />
          <div className="p-4">
            {pending.length > 0
              ? <button onClick={() => { setTab('aprovar'); setStage('swipe'); }} className={BTN}>Voltar para aprovar ({pending.length})</button>
              : <button onClick={() => { setTab('aprovar'); setStage('done'); }} className="w-full rounded-xl bg-white/10 py-3 text-sm font-semibold text-white">Voltar</button>}
          </div>
        </div>
      ) : stage === 'start' && !allDone ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="m-auto flex w-full max-w-sm flex-col items-center px-6 text-center">
          <Avatar src={client.logo_url} name={client.name} size={84} />
          <h1 className="display mt-5 text-4xl">{pending.length} {pending.length === 1 ? 'arte para aprovar' : 'artes para aprovar'}</h1>
          <p className="mt-3 text-sm text-neutral-300">Cada card é um post como vai aparecer no Instagram. Arraste para a <b className="text-brand-400">direita para aprovar</b> ou para a <b className="text-red-400">esquerda para pedir ajustes</b>.</p>
          {(counts.approved + counts.rejected) > 0 && <p className="mt-2 text-xs text-neutral-500">Você já respondeu {counts.approved + counts.rejected} nesta rodada.</p>}
          <button onClick={() => setStage('swipe')} className={`${BTN} mt-6`}>Começar</button>
          <button onClick={() => setTab('feed')} className="mt-3 text-sm text-neutral-400 underline">Ver prévia do feed</button>
          <Footer />
        </motion.div>
      ) : stage === 'swipe' && !allDone ? (
        <div className="flex flex-1 flex-col px-4 pb-3">
          <div className="mb-2 flex items-center justify-between text-xs text-neutral-400">
            <span>{data.creatives.length - pending.length + 1} de {data.creatives.length}</span>
            <span className="text-brand-400">{counts.approved} ✓</span>
          </div>
          <SwipeStack items={pending} client={client} onDecide={decide} />
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center overflow-y-auto px-6 pb-6 pt-4 text-center">
          <h1 className="display text-4xl">{alreadySent ? 'Enviado!' : counts.rejected ? 'Quase lá!' : 'Tudo aprovado!'}</h1>
          <div className="mt-4 grid w-full grid-cols-2 gap-2">
            <div className="rounded-xl bg-brand-500/15 p-3 ring-1 ring-brand-500/40"><div className="display text-3xl text-brand-400">{counts.approved}</div><div className="text-xs text-brand-200">aprovada{counts.approved !== 1 && 's'}</div></div>
            <div className="rounded-xl bg-red-500/10 p-3 ring-1 ring-red-500/30"><div className="display text-3xl text-red-400">{counts.rejected}</div><div className="text-xs text-red-200">para ajustar</div></div>
          </div>
          {counts.rejected > 0 && !alreadySent && <p className="mt-3 text-sm text-neutral-400">A agência vai receber seus comentários e enviar as novas versões por este mesmo link.</p>}

          {alreadySent ? (
            <div className="mt-6 w-full rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
              <p className="text-sm font-medium text-brand-400">Aprovação enviada. Obrigado!</p>
              {batch.feedback || rating > 0 ? (
                <div className="mt-3 flex flex-col items-center gap-1.5">
                  <Stars value={batch.feedback?.rating ?? rating} size={22} />
                  <p className="text-sm text-neutral-300">“{batch.feedback?.comment ?? comment}”</p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-6 w-full rounded-2xl bg-white/5 p-4 text-left ring-1 ring-white/10">
              <h2 className="display text-2xl">Como foi a experiência?</h2>
              <p className="mt-1 text-xs text-neutral-400">Sua avaliação é obrigatória para concluir o envio. É rápido: uma nota e uma frase.</p>
              <div className="mt-3 flex items-center justify-center gap-1">
                <Stars value={rating} onChange={setRating} size={34} />
              </div>
              <div className="mt-1 text-center text-xs text-neutral-500">{RATING_LABEL[rating] ?? 'Toque nas estrelas'}</div>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} placeholder="Em uma frase: o que achou das artes e do processo?"
                className="mt-3 min-h-20 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-brand-500" />
              <button onClick={submit} disabled={sending || !canSubmit} className={`${BTN} mt-3`}>{sending ? 'Enviando…' : 'Enviar aprovação'}</button>
              {!canSubmit && <p className="mt-2 text-center text-[11px] text-neutral-500">{rating < 1 ? 'Escolha de 1 a 5 estrelas' : 'Escreva pelo menos uma frase'}</p>}
            </div>
          )}
          <button onClick={() => setTab('feed')} className="mt-4 text-sm text-neutral-400 underline">Ver como ficou o feed</button>
          <Footer />
        </motion.div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => { setPreview(null); setChanging(false); }}>
          <div className={`flex w-full max-w-sm flex-col gap-2 transition-[padding] ${preview.type === 'story' || (changing && !changeMin) ? 'h-[92vh]' : 'max-h-[92vh]'}`}
            style={{ paddingBottom: changing && !changeMin ? changeSheetH : 0 }} onClick={(e) => e.stopPropagation()}>
            {/* com a folha de recusa aberta, a coluna ganha altura fixa e reserva a altura da folha; só assim o post (h-full) encolhe de verdade */}
            <div className="min-h-0 flex-1"><PostCard c={preview} client={client} /></div>
            {/* decisão atual + troca (enquanto não enviada) */}
            <div className="shrink-0 rounded-2xl bg-neutral-950 p-3 text-sm ring-1 ring-white/15">
              {preview.status === 'pending' ? (
                <div className="text-center text-xs text-neutral-400">Ainda sem resposta. Responda pela aba Aprovar.</div>
              ) : (
                <>
                  <div className="mb-2 text-center text-xs text-neutral-300">
                    {preview.status === 'rejected'
                      ? <>Você pediu ajustes{preview.decision?.reason_category && <>: <b className="text-red-300">{REASON_LABEL[preview.decision.reason_category]}</b></>}</>
                      : <>Você <b className="text-brand-400">aprovou</b> esta arte</>}
                  </div>
                  {changing ? (
                    <div className="text-center text-xs text-neutral-400">Escolha o motivo na folha abaixo.</div>
                  ) : canChange(preview) ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button disabled={changeBusy || preview.status === 'rejected'} onClick={() => setChanging(true)} className="rounded-xl border border-red-500/60 py-2.5 text-sm font-semibold text-red-300 disabled:opacity-35">✕ Pedir ajustes</button>
                      <button disabled={changeBusy || preview.status !== 'rejected'} onClick={() => change(preview, 'approved')} className="rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-black disabled:opacity-35">✓ Aprovar</button>
                    </div>
                  ) : (
                    <div className="text-center text-[11px] text-neutral-500">Resposta já enviada para a agência. Para mudar, peça uma nova versão.</div>
                  )}
                </>
              )}
            </div>
            <button onClick={() => { setPreview(null); setChanging(false); }} className="shrink-0 text-center text-xs text-neutral-400 underline">fechar</button>
          </div>
          <RejectSheet open={changing} busy={changeBusy} onMinimized={setChangeMin} onHeight={setChangeSheetH} onCancel={() => setChanging(false)} onConfirm={(r, cm) => change(preview, 'rejected', r, cm)} />
        </div>
      )}
    </Shell>
  );
}

/** Faixa de stories no topo da prévia do feed, como no perfil do Instagram. Toque abre o story em tela cheia. */
function StoriesRow({ creatives, onOpen }: { creatives: PublicCreative[]; onOpen: (c: PublicCreative) => void }) {
  const stories = creatives.filter((c) => c.type === 'story');
  if (!stories.length) return null;
  return (
    <div className="flex gap-3 overflow-x-auto px-4 pb-3 no-scrollbar">
      {stories.map((s, i) => {
        const a = s.assets[0];
        const ring = s.status === 'rejected' ? 'ring-red-500' : s.status === 'pending' ? 'ring-white/40' : 'ring-brand-500';
        return (
          <button key={s.id} onClick={() => onOpen(s)} className="flex w-16 shrink-0 flex-col items-center gap-1">
            <span className={`h-16 w-16 overflow-hidden rounded-full bg-neutral-800 p-0.5 ring-2 ${ring}`}>
              {a?.mime.startsWith('video') ? <video src={a.url} muted preload="metadata" className="h-full w-full rounded-full object-cover" /> : <img src={a?.thumb_url ?? a?.url} className="h-full w-full rounded-full object-cover" />}
            </span>
            <span className="text-[10px] text-neutral-400">Story {i + 1}</span>
          </button>
        );
      })}
    </div>
  );
}

const RATING_LABEL: Record<number, string> = { 1: 'Muito ruim', 2: 'Ruim', 3: 'Ok', 4: 'Bom', 5: 'Excelente' };

function Footer() {
  return (
    <div className="mt-8 flex flex-col items-center gap-2 opacity-80">
      <span className="text-[10px] uppercase tracking-widest text-neutral-500">Aprovação por</span>
      <Logo on="dark" className="h-8" />
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="glow-bg mx-auto flex min-h-full w-full max-w-md flex-col text-white sm:my-0">{children}</div>;
}

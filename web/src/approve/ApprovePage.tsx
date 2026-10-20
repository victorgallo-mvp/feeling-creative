import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, ApiError } from '../api/client';
import type { PublicBatch, PublicCreative, RejectReason } from '../api/types';
import { Avatar, Spinner } from '../components/ui';
import { MONTHS } from '../lib/format';
import { SwipeStack } from './SwipeStack';
import { FeedGrid } from './FeedGrid';
import { PostCard } from './PostCard';
import { toast } from '../components/toastStore';

type Decision = { creative_id: number; version: number; action: 'approved' | 'rejected'; reason_category?: RejectReason | null; comment?: string | null };
type Stage = 'start' | 'swipe' | 'done';

export function ApprovePage() {
  const { token = '' } = useParams();
  const [data, setData] = useState<PublicBatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('start');
  const [tab, setTab] = useState<'aprovar' | 'feed'>('aprovar');
  const [preview, setPreview] = useState<PublicCreative | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [session, setSession] = useState({ approved: 0, rejected: 0 });
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

  const submit = async () => {
    setSending(true);
    try { await api.post(`/api/a/${token}/submit`, {}, { auth: false }); setSubmitted(true); toast('Aprovação enviada. Obrigado!'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Erro ao enviar', 'error'); }
    finally { setSending(false); }
  };

  if (error) return <Shell><div className="m-auto max-w-sm p-6 text-center"><div className="text-4xl">🔗</div><h1 className="mt-2 text-lg font-semibold">Link indisponível</h1><p className="mt-1 text-sm text-neutral-500">{error}</p></div></Shell>;
  if (!data) return <Shell><div className="m-auto"><Spinner /></div></Shell>;

  const { client, batch } = data;
  const monthName = `${MONTHS[batch.month - 1]} de ${batch.year}`;
  const allDone = pending.length === 0;

  return (
    <Shell>
      <header className="flex items-center gap-3 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-2">
        <Avatar src={client.logo_url} name={client.name} size={36} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate font-semibold">{client.name}</div>
          <div className="truncate text-xs text-neutral-500">{batch.title ? ` · ` : `Conteúdo de `}</div>
        </div>
        <div className="flex rounded-full bg-neutral-200/70 p-0.5 text-xs font-medium">
          {(['aprovar', 'feed'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1.5 transition ${tab === t ? 'bg-white shadow' : 'text-neutral-500'}`}>{t === 'aprovar' ? 'Aprovar' : 'Ver feed'}</button>
          ))}
        </div>
      </header>

      {tab === 'feed' ? (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-2 text-xs text-neutral-500">Prévia de como o feed vai ficar, da data mais recente para a mais antiga. Toque para ver o post.</div>
          <FeedGrid creatives={data.creatives} onOpen={setPreview} />
          {pending.length > 0 && <div className="p-4"><button onClick={() => { setTab('aprovar'); setStage('swipe'); }} className="w-full rounded-xl bg-neutral-900 py-3 text-sm font-semibold text-white">Voltar para aprovar ({pending.length})</button></div>}
        </div>
      ) : stage === 'start' && !allDone ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="m-auto flex max-w-sm flex-col items-center px-6 text-center">
          <Avatar src={client.logo_url} name={client.name} size={84} />
          <h1 className="mt-4 text-2xl font-bold">{pending.length} {pending.length === 1 ? 'arte para aprovar' : 'artes para aprovar'}</h1>
          <p className="mt-2 text-sm text-neutral-500">Cada card é um post como vai aparecer no Instagram. Arraste para a <b className="text-emerald-600">direita para aprovar</b> ou para a <b className="text-red-600">esquerda para pedir ajustes</b>.</p>
          {(counts.approved + counts.rejected) > 0 && <p className="mt-2 text-xs text-neutral-400">Você já respondeu {counts.approved + counts.rejected} nesta rodada.</p>}
          <button onClick={() => setStage('swipe')} className="mt-6 w-full rounded-xl bg-neutral-900 py-3.5 text-base font-semibold text-white active:scale-[0.98]">Começar</button>
          <button onClick={() => setTab('feed')} className="mt-3 text-sm text-neutral-500 underline">Ver prévia do feed</button>
        </motion.div>
      ) : stage === 'swipe' && !allDone ? (
        <div className="flex flex-1 flex-col px-4 pb-3">
          <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
            <span>{data.creatives.length - pending.length + 1} de {data.creatives.length}</span>
            <span className="text-emerald-600">{counts.approved} ✓</span>
          </div>
          <SwipeStack items={pending} client={client} onDecide={decide} />
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="m-auto flex w-full max-w-sm flex-col items-center px-6 text-center">
          <div className="text-5xl">{counts.rejected ? '📝' : '🎉'}</div>
          <h1 className="mt-3 text-2xl font-bold">{counts.rejected ? 'Quase lá!' : 'Tudo aprovado!'}</h1>
          <div className="mt-4 grid w-full grid-cols-2 gap-2">
            <div className="rounded-xl bg-emerald-50 p-3"><div className="text-2xl font-bold text-emerald-700">{counts.approved}</div><div className="text-xs text-emerald-800">aprovada{counts.approved !== 1 && 's'}</div></div>
            <div className="rounded-xl bg-red-50 p-3"><div className="text-2xl font-bold text-red-700">{counts.rejected}</div><div className="text-xs text-red-800">para ajustar</div></div>
          </div>
          {counts.rejected > 0 && <p className="mt-3 text-sm text-neutral-500">A agência vai receber seus comentários e enviar as novas versões por este mesmo link.</p>}
          {submitted && session.approved + session.rejected === 0 ? (
            <p className="mt-4 text-sm font-medium text-emerald-700">Aprovação já enviada. Obrigado!</p>
          ) : (
            <button onClick={submit} disabled={sending || submitted} className="mt-5 w-full rounded-xl bg-neutral-900 py-3.5 text-base font-semibold text-white disabled:opacity-60">{submitted ? 'Aprovação enviada ✓' : sending ? 'Enviando…' : 'Enviar aprovação'}</button>
          )}
          <button onClick={() => setTab('feed')} className="mt-3 text-sm text-neutral-500 underline">Ver como ficou o feed</button>
        </motion.div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreview(null)}>
          <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}><PostCard c={preview} client={client} /></div>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex min-h-full w-full max-w-md flex-col bg-neutral-50 sm:my-0">{children}</div>;
}

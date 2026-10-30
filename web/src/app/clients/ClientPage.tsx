import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { BatchSummary, Client } from '../../api/types';
import { Avatar, Badge, Button, Empty, Spinner, Stars } from '../../components/ui';
import { LinkActions } from '../../components/LinkActions';
import { KANBAN_LABEL, fmtDate, monthLabel } from '../../lib/format';
import { NewBatchModal } from '../kanban/KanbanPage';

/** Página do cliente: dados, todos os lotes e o link de aprovação de cada um. */
export function ClientPage() {
  const { id } = useParams();
  const client = useQuery({ queryKey: ['client', id], queryFn: () => api.get<Client>(`/api/clients/${id}`) });
  const batches = useQuery({ queryKey: ['batches', 'client', id], queryFn: () => api.get<BatchSummary[]>(`/api/batches?client_id=${id}&all=1`) });
  const [creating, setCreating] = useState(false);
  const now = new Date();

  if (client.isLoading) return <Spinner />;
  if (!client.data) return <Empty>Cliente não encontrado</Empty>;
  const c = client.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/app/clientes" className="text-sm text-neutral-500 hover:text-neutral-900">← Clientes</Link>
        <Avatar src={c.logo_url} name={c.name} size={44} />
        <div>
          <h1 className="display text-3xl text-black">{c.name}</h1>
          <div className="text-sm text-neutral-500">{c.instagram_handle && `@${c.instagram_handle} · `}{c.whatsapp ?? 'sem WhatsApp'} · {c.designer_name ?? '—'} / {c.manager_name ?? '—'}</div>
        </div>
        <div className="flex-1" />
        <Button onClick={() => setCreating(true)}>+ Novo lote</Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
      {c.feedback_count > 0 && c.last_feedback && (
        <div className="rounded-xl bg-white p-4 ring-1 ring-neutral-200">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Avaliação do cliente</div>
          <div className="mt-1 flex items-end gap-2"><span className={`display text-4xl ${(c.feedback_avg ?? 0) <= 2.5 ? 'text-red-600' : 'text-black'}`}>{c.feedback_avg?.toFixed(1)}</span><Stars value={Math.round(c.feedback_avg ?? 0)} size={16} className="mb-1.5" /><span className="mb-1 text-xs text-neutral-500">{c.feedback_count} avaliaç{c.feedback_count === 1 ? 'ão' : 'ões'}</span></div>
          <div className="mt-2 text-xs text-neutral-500">Última · {monthLabel(c.last_feedback.month, c.last_feedback.year)} · <Stars value={c.last_feedback.rating} size={11} className="align-middle" /></div>
          {c.last_feedback.comment && <div className="mt-1 text-sm text-neutral-800">“{c.last_feedback.comment}”</div>}
          <Link to="/app/feedbacks" className="mt-2 inline-block text-xs font-medium underline">Ver todos os feedbacks</Link>
        </div>
      )}
      {c.latest_batch && (
        <div className={`rounded-xl bg-black p-4 text-white ring-1 ring-brand-500/50 ${c.feedback_count > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
          <div className="display mb-2 text-lg text-brand-400">Link de aprovação atual</div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm"><b>{c.latest_batch.title ? `${c.latest_batch.title} · ` : ''}{monthLabel(c.latest_batch.month, c.latest_batch.year)}</b> <span className="text-neutral-500">· {c.latest_batch.pending} de {c.latest_batch.total} pendente{c.latest_batch.pending !== 1 && 's'}</span></div>
            <code className="max-w-full truncate rounded bg-white/10 px-2 py-1 text-xs text-neutral-200">{c.latest_batch.link}</code>
            <LinkActions link={c.latest_batch.link} />
          </div>
        </div>
      )}
      </div>

      <section className="overflow-hidden rounded-xl bg-white ring-1 ring-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr><th className="px-4 py-2">Lote</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Artes</th><th className="px-4 py-2">Link enviado</th><th className="px-4 py-2">Avaliação</th><th className="px-4 py-2">Link de aprovação</th><th /></tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {batches.isLoading && <tr><td className="px-4 py-3" colSpan={7}><Spinner /></td></tr>}
            {batches.data?.length === 0 && <tr><td className="px-4 py-6 text-center text-neutral-500" colSpan={7}>Nenhum lote ainda.</td></tr>}
            {batches.data?.map((b) => (
              <tr key={b.id} className="hover:bg-neutral-50">
                <td className="px-4 py-2"><Link to={`/app/lotes/${b.id}`} className="font-medium hover:underline">{monthLabel(b.month, b.year)}</Link>{b.title && <div className="text-xs text-neutral-500">{b.title}</div>}</td>
                <td className="px-4 py-2"><Badge tone={b.kanban_status === 'aprovado' || b.kanban_status === 'programado' ? 'green' : b.kanban_status === 'enviado_aprovacao' ? (b.stuck ? 'red' : 'amber') : 'neutral'}>{KANBAN_LABEL[b.kanban_status]}</Badge>{b.archived_at && <Badge>arquivado</Badge>}</td>
                <td className="px-4 py-2 text-neutral-600">{b.approved}/{b.total} aprovadas{b.rejected > 0 && <span className="text-red-700"> · {b.rejected} recusada{b.rejected > 1 && 's'}</span>}</td>
                <td className="px-4 py-2 text-neutral-600">{b.link_sent_at ? fmtDate(b.link_sent_at, true) : '—'}{b.viewed_at && <div className="text-xs text-neutral-400">aberto {fmtDate(b.viewed_at, true)}</div>}</td>
                <td className="px-4 py-2">{b.feedback_rating ? <div title={b.feedback_comment ?? ''}><Stars value={b.feedback_rating} size={14} />{b.feedback_comment && <div className="max-w-48 truncate text-xs text-neutral-500">“{b.feedback_comment}”</div>}</div> : <span className="text-xs text-neutral-400">—</span>}</td>
                <td className="px-4 py-2">{b.link ? <LinkActions link={b.link} size="sm" /> : <span className="text-xs text-neutral-400">gere no lote</span>}</td>
                <td className="px-4 py-2 text-right"><Link to={`/app/lotes/${b.id}`} className="text-xs font-medium underline">Abrir lote</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <NewBatchModal open={creating} onClose={() => setCreating(false)} month={now.getMonth() + 1} year={now.getFullYear()} clientId={c.id} />
    </div>
  );
}

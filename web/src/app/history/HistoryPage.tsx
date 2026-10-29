import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { ActivityRow, Client } from '../../api/types';
import { Avatar, Empty, PageTitle, Select, Spinner, Stars } from '../../components/ui';
import { EVENT_LABEL, KANBAN_LABEL, REASON_LABEL, fmtDate, monthLabel } from '../../lib/format';

/** Histórico completo de movimentação (clientes e equipe). Só consulta: sem badge, sem alerta. */
export function HistoryPage() {
  const [f, setF] = useState<{ client_id: number | ''; kind: string; source: '' | 'client' | 'team' }>({ client_id: '', kind: '', source: '' });
  const qs = new URLSearchParams();
  if (f.client_id) qs.set('client_id', String(f.client_id));
  if (f.kind) qs.set('kind', f.kind);
  if (f.source) qs.set('source', f.source);
  const list = useQuery({ queryKey: ['activity', qs.toString()], queryFn: () => api.get<ActivityRow[]>(`/api/activity?${qs}`) });
  const clients = useQuery({ queryKey: ['clients'], queryFn: () => api.get<Client[]>('/api/clients') });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <PageTitle>Histórico</PageTitle>
        <span className="text-sm text-neutral-500">toda a movimentação, do mais recente para o mais antigo</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={f.client_id} onChange={(e) => setF({ ...f, client_id: e.target.value ? Number(e.target.value) : '' })} className="w-48"><option value="">Todos os clientes</option>{clients.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <Select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value as any })} className="w-40"><option value="">Cliente e equipe</option><option value="client">Só cliente</option><option value="team">Só equipe</option></Select>
        <Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className="w-56"><option value="">Todos os eventos</option>{Object.entries(EVENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        {(f.client_id || f.kind || f.source) && <button className="text-xs text-neutral-500 underline" onClick={() => setF({ client_id: '', kind: '', source: '' })}>limpar</button>}
      </div>

      {list.isLoading ? <Spinner /> : !list.data?.length ? <Empty>Nada por aqui com esses filtros.</Empty> : (
        <div className="overflow-hidden rounded-xl bg-white ring-1 ring-neutral-200">
          <ul className="divide-y divide-neutral-100 text-sm">
            {list.data.map((e) => <Row key={e.id} e={e} />)}
          </ul>
        </div>
      )}
    </div>
  );
}

function Row({ e }: { e: ActivityRow }) {
  const p = e.payload ?? {};
  const client = e.actor_name == null;
  const tone = e.kind === 'creative_rejected' ? 'text-red-700' : e.kind === 'creative_approved' || e.kind === 'batch_submitted' ? 'text-brand-800' : 'text-neutral-800';
  const art = e.creative_index ? ` · arte #${e.creative_index}` : '';
  return (
    <li className="flex items-start gap-3 px-4 py-2.5">
      <span className="w-28 shrink-0 pt-0.5 text-xs text-neutral-400">{fmtDate(e.created_at, true)}</span>
      <Avatar src={e.client_logo_url} name={e.client_name} size={24} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2">
          <Link to={`/app/clientes/${e.client_id}`} className="font-medium hover:underline">{e.client_name}</Link>
          <Link to={`/app/lotes/${e.batch_id}${e.creative_id ? `#arte-${e.creative_id}` : ''}`} className="text-neutral-500 hover:underline">{e.title ? `${e.title} · ` : ''}{monthLabel(e.month, e.year)}{art}</Link>
          <span className={`font-medium ${tone}`}>{EVENT_LABEL[e.kind] ?? e.kind}</span>
          {p.version && e.kind !== 'batch_submitted' && <span className="text-xs text-neutral-400">v{p.version}</span>}
          <span className={`rounded-full px-1.5 text-[10px] ${client ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'}`}>{client ? 'cliente' : e.actor_name}</span>
        </div>
        {e.kind === 'creative_decision_changed' && <div className="text-xs text-neutral-600">de <b>{p.from === 'rejected' ? 'recusada' : 'aprovada'}</b> para <b>{p.to === 'rejected' ? 'recusada' : 'aprovada'}</b></div>}
        {p.reason_category && <div className="text-xs text-red-700">{REASON_LABEL[p.reason_category as keyof typeof REASON_LABEL]}{p.comment && ` — “${p.comment}”`}</div>}
        {e.kind === 'batch_submitted' && (p.rating ? <div className="flex items-center gap-1.5 text-xs text-neutral-600"><Stars value={p.rating} size={12} />{p.comment && <span>“{p.comment}”</span>}</div> : <div className="text-xs text-neutral-500">{p.approved} aprovada(s), {p.rejected} recusada(s)</div>)}
        {e.kind === 'kanban_moved' && p.to && <div className="text-xs text-neutral-600">para <b>{KANBAN_LABEL[p.to as keyof typeof KANBAN_LABEL] ?? p.to}</b></div>}
        {p.note && <div className="text-xs text-neutral-600">“{p.note}”</div>}
      </div>
    </li>
  );
}

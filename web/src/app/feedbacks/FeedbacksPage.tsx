import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { Client, FeedbackList } from '../../api/types';
import { Avatar, Badge, Button, Empty, PageTitle, Select, Spinner, Stars } from '../../components/ui';
import { MONTHS, fmtDate, monthLabel } from '../../lib/format';

type Filters = { client_id: number | ''; month: number | ''; year: number | ''; rating: number | ''; low: boolean; unread: boolean };

/** Todos os feedbacks dados pelos clientes ao enviar a aprovação: média, distribuição, filtros e lista. */
export function FeedbacksPage() {
  const qc = useQueryClient();
  const [sp] = useSearchParams();
  const [f, setF] = useState<Filters>({ client_id: '', month: '', year: '', rating: '', low: sp.get('rating') === 'low', unread: sp.get('rating') === 'low' });
  const qs = new URLSearchParams();
  if (f.client_id) qs.set('client_id', String(f.client_id));
  if (f.month) qs.set('month', String(f.month));
  if (f.year) qs.set('year', String(f.year));
  if (f.rating) qs.set('rating', String(f.rating));
  if (f.unread) qs.set('unread', '1');
  const list = useQuery({ queryKey: ['feedbacks', qs.toString()], queryFn: () => api.get<FeedbackList>(`/api/feedbacks?${qs}`) });
  const clients = useQuery({ queryKey: ['clients'], queryFn: () => api.get<Client[]>('/api/clients') });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['feedbacks'] }); qc.invalidateQueries({ queryKey: ['feedback-count'] }); };
  const read = useMutation({ mutationFn: (id: number) => api.post(`/api/feedbacks/${id}/read`), onSuccess: invalidate });
  const readAll = useMutation({ mutationFn: () => api.post('/api/feedbacks/read-all'), onSuccess: invalidate });

  const now = new Date();
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
  const s = list.data?.summary;
  const items = (list.data?.items ?? []).filter((r) => !f.low || r.rating <= 2);
  const set = (k: keyof Filters, v: any) => setF((x) => ({ ...x, [k]: v }));
  const filtered = !!(f.client_id || f.month || f.year || f.rating || f.unread || f.low);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <PageTitle>Feedbacks dos clientes</PageTitle>
        {s && s.unread > 0 && <Badge tone="green">{s.unread} novo{s.unread > 1 && 's'}</Badge>}
        <div className="flex-1" />
        {s && s.unread > 0 && <Button variant="secondary" onClick={() => readAll.mutate()} loading={readAll.isPending}>Marcar todos como vistos</Button>}
      </div>

      {s && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-black p-4 text-white ring-1 ring-brand-500/50">
            <div className="text-xs uppercase tracking-wide text-neutral-400">Nota média</div>
            <div className="mt-1 flex items-end gap-3"><span className="display text-5xl text-brand-400">{s.avg != null ? s.avg.toFixed(1) : '—'}</span><Stars value={Math.round(s.avg ?? 0)} size={18} className="mb-2" /></div>
            <div className="mt-1 text-xs text-neutral-400">{s.total} avaliaç{s.total === 1 ? 'ão' : 'ões'}{s.low > 0 && <span className="text-red-400"> · {s.low} com nota baixa</span>}</div>
          </div>
          <div className="rounded-xl bg-white p-4 ring-1 ring-neutral-200 sm:col-span-2">
            <div className="text-xs uppercase tracking-wide text-neutral-500">Distribuição (clique para filtrar)</div>
            <div className="mt-2 space-y-1">
              {([5, 4, 3, 2, 1] as const).map((n) => {
                const v = s.dist[String(n) as '1'] ?? 0; const pct = s.total ? Math.round((v / s.total) * 100) : 0;
                return (
                  <button key={n} onClick={() => set('rating', f.rating === n ? '' : n)} className={`flex w-full items-center gap-2 rounded px-1 text-xs hover:bg-neutral-50 ${f.rating === n ? 'bg-brand-50' : ''}`}>
                    <span className="w-6 text-right font-medium">{n}★</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100"><span className={`block h-full rounded-full ${n <= 2 ? 'bg-red-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} /></span>
                    <span className="w-14 text-right text-neutral-500">{v} · {pct}%</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select value={f.client_id} onChange={(e) => set('client_id', e.target.value ? Number(e.target.value) : '')} className="w-48"><option value="">Todos os clientes</option>{clients.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <Select value={f.month} onChange={(e) => set('month', e.target.value ? Number(e.target.value) : '')} className="w-36"><option value="">Todos os meses</option>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</Select>
        <Select value={f.year} onChange={(e) => set('year', e.target.value ? Number(e.target.value) : '')} className="w-28"><option value="">Ano</option>{years.map((y) => <option key={y} value={y}>{y}</option>)}</Select>
        <Select value={f.rating} onChange={(e) => set('rating', e.target.value ? Number(e.target.value) : '')} className="w-32"><option value="">Toda nota</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} estrela{n > 1 && 's'}</option>)}</Select>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={f.low} onChange={(e) => set('low', e.target.checked)} /> só nota baixa</label>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={f.unread} onChange={(e) => set('unread', e.target.checked)} /> só novos</label>
        {filtered && <button className="text-xs text-neutral-500 underline" onClick={() => setF({ client_id: '', month: '', year: '', rating: '', low: false, unread: false })}>limpar</button>}
      </div>

      {list.isLoading ? <Spinner /> : !items.length ? <Empty>{s && s.total === 0 && !filtered ? 'Nenhum feedback ainda. Ele chega quando o cliente conclui uma aprovação.' : 'Nenhum feedback com esses filtros.'}</Empty> : (
        <div className="space-y-2">
          {items.map((r) => (
            <div key={r.batch_id} className={`flex gap-3 rounded-xl bg-white p-3 ring-1 ${!r.read_at ? 'ring-brand-500/60' : r.rating <= 2 ? 'ring-red-200' : 'ring-neutral-200'}`}>
              <Link to={`/app/clientes/${r.client_id}`} className="shrink-0"><Avatar src={r.client_logo_url} name={r.client_name} size={40} /></Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Link to={`/app/clientes/${r.client_id}`} className="font-semibold hover:underline">{r.client_name}</Link>
                  <span className="text-neutral-500">· {r.title ? `${r.title} · ` : ''}{monthLabel(r.month, r.year)} · {r.total} arte{r.total !== 1 && 's'}</span>
                  <Stars value={r.rating} size={16} />
                  {r.rating <= 2 && <Badge tone="red">nota baixa</Badge>}
                  {!r.read_at && <Badge tone="green">novo</Badge>}
                </div>
                {r.comment && <div className="mt-1.5 rounded-md bg-neutral-50 px-3 py-2 text-sm text-neutral-800">“{r.comment}”</div>}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                  <span>{fmtDate(r.at, true)}</span>
                  <span>{r.designer_name ?? '—'} / {r.manager_name ?? '—'}</span>
                  <Link to={`/app/lotes/${r.batch_id}`} className="font-medium text-neutral-900 underline">Abrir lote</Link>
                  {!r.read_at && <button onClick={() => read.mutate(r.batch_id)} className="underline">marcar como visto</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

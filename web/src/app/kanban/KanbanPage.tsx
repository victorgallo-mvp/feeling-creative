import { useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { BatchSummary, Client, KanbanStatus } from '../../api/types';
import { Avatar, Badge, Button, Field, Input, Modal, PageTitle, Select, Spinner, Stars } from '../../components/ui';
import { KANBAN_LABEL, MONTHS, daysAgo } from '../../lib/format';
import { toast, toastError } from '../../components/toastStore';
import { LinkActions } from '../../components/LinkActions';
import { AlertsBar } from './AlertsBar';
import { BatchActions } from '../batches/BatchActions';

const COLUMNS: KanbanStatus[] = ['briefing', 'em_producao', 'enviado_aprovacao', 'aprovado', 'programado'];
const MANUAL: KanbanStatus[] = ['briefing', 'em_producao', 'programado'];

export function KanbanPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const qc = useQueryClient();
  const batches = useQuery({ queryKey: ['batches', month, year, showArchived], queryFn: () => api.get<BatchSummary[]>(`/api/batches?month=${month}&year=${year}${showArchived ? '&archived=1' : ''}`) });
  const archivedCount = useQuery({ queryKey: ['batches', 'archived-count', month, year], queryFn: () => api.get<BatchSummary[]>(`/api/batches?month=${month}&year=${year}&archived=1`), select: (d) => d.length });

  const move = useMutation({
    mutationFn: ({ id, status }: { id: number; status: KanbanStatus }) => api.patch(`/api/batches/${id}/kanban`, { kanban_status: status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['batches'] }),
    onError: toastError,
  });

  const onDrop = (e: DragEvent, status: KanbanStatus) => {
    e.preventDefault();
    const id = Number(e.dataTransfer.getData('text/batch'));
    if (!id) return;
    if (!MANUAL.includes(status)) return toast('Essa coluna muda automaticamente', 'error');
    move.mutate({ id, status });
  };

  const years = [year - 1, year, year + 1];

  return (
    <div className="space-y-4">
      <AlertsBar />
      <div className="flex flex-wrap items-center gap-3">
        <PageTitle>Kanban</PageTitle>
        <div className="flex gap-2">
          <Select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="w-36">{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</Select>
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24">{years.map((y) => <option key={y} value={y}>{y}</option>)}</Select>
        </div>
        <button type="button" onClick={() => setShowArchived((v) => !v)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${showArchived ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-100'}`}>
          {showArchived ? '← Voltar ao Kanban' : `Arquivados${archivedCount.data ? ` (${archivedCount.data})` : ''}`}
        </button>
        <div className="flex-1" />
        <Button onClick={() => setCreating(true)}>+ Novo lote</Button>
      </div>
      {showArchived && <p className="text-sm text-neutral-500">Lotes arquivados deste mês: fora do Kanban, mas com artes, respostas, feedback e histórico guardados. Restaure pelo menu ⋯ do card.</p>}

      {batches.isLoading ? <Spinner /> : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
          {COLUMNS.map((col) => {
            const items = (batches.data ?? []).filter((b) => b.kanban_status === col);
            return (
              <div key={col} onDragOver={(e) => MANUAL.includes(col) && e.preventDefault()} onDrop={(e) => onDrop(e, col)}
                className={`min-h-40 rounded-xl p-2 ${MANUAL.includes(col) ? 'bg-neutral-100' : 'bg-neutral-100/60 ring-1 ring-inset ring-dashed ring-neutral-300'}`}>
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="display text-base text-neutral-800">{KANBAN_LABEL[col]}</span>
                  <span className="text-xs text-neutral-400">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((b) => <Card key={b.id} b={b} draggable={b.kanban_status !== 'enviado_aprovacao' || true} />)}
                  {!MANUAL.includes(col) && items.length === 0 && <div className="px-1 text-xs text-neutral-400">automático</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <NewBatchModal open={creating} onClose={() => setCreating(false)} month={month} year={year} />
    </div>
  );
}

function Card({ b, draggable }: { b: BatchSummary; draggable: boolean }) {
  const pct = b.total ? Math.round((b.approved / b.total) * 100) : 0;
  const days = daysAgo(b.status_changed_at);
  return (
    <Link to={`/app/lotes/${b.id}`} draggable={draggable}
      onDragStart={(e) => e.dataTransfer.setData('text/batch', String(b.id))}
      className={`block rounded-lg bg-white p-3 shadow-sm ring-1 transition hover:shadow ${b.stuck ? 'ring-red-300' : 'ring-neutral-200'}`}>
      <div className="flex items-center gap-2">
        <Avatar src={b.client_logo_url} name={b.client_name} size={28} />
        <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{b.client_name}</div>{b.title && <div className="truncate text-[11px] text-neutral-500">{b.title}</div>}</div>
        {b.archived_at && <Badge>arquivado</Badge>}
        <BatchActions b={b} />
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-neutral-600">
        <span>{b.approved}/{b.total} aprovadas</span>
        {b.rejected > 0 && <Badge tone="red">{b.rejected} recusada{b.rejected > 1 && 's'}</Badge>}
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100">
        <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-500">
        <span className="truncate">{b.designer_name ?? '—'} · {b.manager_name ?? '—'}</span>
        {b.stuck ? <span className="font-semibold text-red-600">⚠ {days}d parado</span> : <span>{days}d</span>}
      </div>
      {b.feedback_rating && <div className="mt-2 flex items-center gap-1.5 text-[11px] text-neutral-500" title={b.feedback_comment ?? ''}><Stars value={b.feedback_rating} size={12} /><span className="truncate">{b.feedback_comment}</span></div>}
      {b.link && <div className="mt-2"><LinkActions link={b.link} size="sm" /></div>}
    </Link>
  );
}

export function NewBatchModal({ open, onClose, month, year, clientId: fixedClient }: { open: boolean; onClose: () => void; month: number; year: number; clientId?: number }) {
  const qc = useQueryClient();
  const clients = useQuery({ queryKey: ['clients'], queryFn: () => api.get<Client[]>('/api/clients'), enabled: open && !fixedClient });
  const [clientId, setClientId] = useState<number | ''>(fixedClient ?? '');
  const [m, setM] = useState(month);
  const [y, setY] = useState(year);
  const [title, setTitle] = useState('');
  const create = useMutation({
    mutationFn: () => api.post<{ id: number }>('/api/batches', { client_id: clientId, month: m, year: y, title: title.trim() || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['batches'] }); toast('Lote criado'); setTitle(''); onClose(); },
    onError: toastError,
  });
  return (
    <Modal open={open} onClose={onClose} title="Novo lote">
      <div className="space-y-3">
        {!fixedClient && (
          <Field label="Cliente">
            <Select value={clientId} onChange={(e) => setClientId(Number(e.target.value))}>
              <option value="">Selecione…</option>
              {clients.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mês"><Select value={m} onChange={(e) => setM(Number(e.target.value))}>{MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}</Select></Field>
          <Field label="Ano"><Select value={y} onChange={(e) => setY(Number(e.target.value))}>{[y - 1, y, y + 1].map((v) => <option key={v} value={v}>{v}</option>)}</Select></Field>
        </div>
        <Field label="Nome do lote (opcional)" hint="Use quando houver mais de um lote no mês, ex.: Lote 2, Black Friday"><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Conteúdo mensal" /></Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => create.mutate()} disabled={!clientId} loading={create.isPending}>Criar lote</Button>
        </div>
      </div>
    </Modal>
  );
}

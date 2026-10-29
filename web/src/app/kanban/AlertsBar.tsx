import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { Alert } from '../../api/types';
import { Avatar, Stars } from '../../components/ui';
import { fmtDate, monthLabel } from '../../lib/format';

/**
 * Alertas no topo do painel: só "cliente enviou a aprovação" e "cliente recusou N artes".
 * Nada aparece sem novidade. Dispensar tira daqui; o histórico completo fica na aba Histórico.
 */
export function AlertsBar() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['alerts'], queryFn: () => api.get<Alert[]>('/api/alerts'), refetchInterval: 30_000 });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['alerts'] });
  const dismiss = useMutation({ mutationFn: (ids: number[]) => api.post('/api/alerts/dismiss', { event_ids: ids }), onSuccess: invalidate });
  const dismissAll = useMutation({ mutationFn: () => api.post('/api/alerts/dismiss-all'), onSuccess: invalidate });
  const items = q.data ?? [];
  if (!items.length) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="display text-lg">Novidades dos clientes</span>
        <span className="rounded-full bg-black px-2 text-[11px] font-semibold text-white">{items.length}</span>
        <span className="flex-1" />
        {items.length > 1 && <button onClick={() => dismissAll.mutate()} className="text-xs text-neutral-500 underline">dispensar todos</button>}
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {items.map((a) => {
          const ok = a.kind === 'batch_submitted';
          const lote = `${a.title ? `${a.title} · ` : ''}${monthLabel(a.month, a.year)}`;
          return (
            <div key={`${a.kind}-${a.batch_id}`} className={`flex items-start gap-3 rounded-xl p-3 ring-1 ${ok ? 'bg-brand-50 ring-brand-500/50' : 'bg-red-50 ring-red-300'}`}>
              <Avatar src={a.client_logo_url} name={a.client_name} size={36} />
              <div className="min-w-0 flex-1">
                <div className={`text-sm ${ok ? 'text-brand-900' : 'text-red-900'}`}>
                  <b>{a.client_name}</b> {ok ? 'enviou a aprovação' : `recusou ${a.count} arte${a.count > 1 ? 's' : ''}`} <span className="opacity-70">· {lote}</span>
                </div>
                {ok && a.rating && <div className="mt-0.5 flex items-center gap-1.5 text-xs text-brand-900"><Stars value={a.rating} size={13} />{a.comment && <span className="truncate">“{a.comment}”</span>}</div>}
                {!ok && <div className="mt-0.5 text-xs text-red-800">{a.rejected_now > 0 ? `${a.rejected_now} aguardando nova versão` : 'já tratadas'}</div>}
                <div className="mt-1.5 flex items-center gap-3 text-xs">
                  <span className="text-neutral-500">{fmtDate(a.at, true)}</span>
                  <Link to={`/app/lotes/${a.batch_id}`} className={`font-semibold underline ${ok ? 'text-brand-900' : 'text-red-900'}`}>Abrir lote</Link>
                  <button onClick={() => dismiss.mutate(a.event_ids)} className="text-neutral-500 underline">dispensar</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

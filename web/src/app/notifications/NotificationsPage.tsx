import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { Notification } from '../../api/types';
import { Badge, Button, Empty, Spinner } from '../../components/ui';
import { REASON_LABEL, TYPE_LABEL, fmtDate, monthLabel } from '../../lib/format';

export function NotificationsPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['notifications'], queryFn: () => api.get<Notification[]>('/api/notifications?all=1') });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['notifications'] }); qc.invalidateQueries({ queryKey: ['notif-count'] }); };
  const read = useMutation({ mutationFn: (id: number) => api.post(`/api/notifications/${id}/read`), onSuccess: invalidate });
  const readAll = useMutation({ mutationFn: () => api.post('/api/notifications/read-all'), onSuccess: invalidate });
  const unread = list.data?.filter((n) => !n.read_at) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Recusas</h1>
        {unread.length > 0 && <Badge tone="red">{unread.length} nova{unread.length > 1 && 's'}</Badge>}
        <div className="flex-1" />
        {unread.length > 0 && <Button variant="secondary" onClick={() => readAll.mutate()}>Marcar todas como vistas</Button>}
      </div>
      {list.isLoading ? <Spinner /> : !list.data?.length ? <Empty>Nenhuma recusa até agora. 🎉</Empty> : (
        <div className="space-y-2">
          {list.data.map((n) => (
            <div key={n.id} className={`flex gap-3 rounded-xl bg-white p-3 ring-1 ${n.read_at ? 'ring-neutral-200 opacity-70' : 'ring-red-200'}`}>
              <Link to={`/app/lotes/${n.batch_id}#arte-${n.creative_id}`} className="shrink-0">
                {n.thumb_url ? <img src={n.thumb_url} className="h-20 w-16 rounded-md object-cover" /> : <div className="h-20 w-16 rounded-md bg-neutral-200" />}
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold">{n.client_name}</span>
                  <span className="text-neutral-500">· {monthLabel(n.month, n.year)} · {TYPE_LABEL[n.creative_type]} #{n.sort_order} · v{n.payload.version}</span>
                  {!n.read_at && <Badge tone="red">nova</Badge>}
                  {n.creative_status === 'pending' && <Badge tone="blue">nova versão enviada</Badge>}
                </div>
                <div className="mt-1 text-sm"><span className="font-medium">Motivo:</span> {n.payload.reason_category ? REASON_LABEL[n.payload.reason_category] : '—'}</div>
                {n.payload.comment && <div className="mt-1 rounded-md bg-neutral-50 px-2 py-1 text-sm text-neutral-700">“{n.payload.comment}”</div>}
                <div className="mt-2 flex items-center gap-3 text-xs text-neutral-500">
                  <span>{fmtDate(n.created_at, true)}</span>
                  <Link to={`/app/lotes/${n.batch_id}#arte-${n.creative_id}`} className="font-medium text-neutral-900 underline">Abrir lote e subir nova versão</Link>
                  {!n.read_at && <button onClick={() => read.mutate(n.id)} className="underline">marcar como vista</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

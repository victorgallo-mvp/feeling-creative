import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { BatchSummary } from '../../api/types';
import { Button, Modal } from '../../components/ui';
import { monthLabel } from '../../lib/format';
import { toast, toastError } from '../../components/toastStore';

/**
 * Ações de "limpeza" de um lote, usadas no card do Kanban e na página do lote:
 * - Arquivar: some do Kanban e das listas, fica no banco (artes, respostas, feedback, histórico). Reversível.
 * - Excluir: apaga tudo, inclusive arquivos. Definitivo. Liberado para designer e gestor.
 */
export function BatchActions({ b, variant = 'menu', afterDelete }: { b: Pick<BatchSummary, 'id' | 'client_name' | 'month' | 'year' | 'title' | 'total' | 'pending' | 'link_sent_at' | 'submitted_at'> & { archived_at?: string | null }; variant?: 'menu' | 'buttons'; afterDelete?: 'home' | 'stay' }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState('');
  const invalidate = () => ['batches', 'batch', 'clients', 'client', 'alerts', 'feedbacks', 'feedback-count', 'notifications', 'notif-count', 'activity'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const label = `${b.client_name} · ${b.title ? `${b.title} · ` : ''}${monthLabel(b.month, b.year)}`;
  const archived = !!b.archived_at;

  const archive = useMutation({
    mutationFn: (v: boolean) => api.patch(`/api/batches/${b.id}/archive`, { archived: v }),
    onSuccess: (_r, v) => { invalidate(); toast(v ? `Lote arquivado: ${label}. Está em "Arquivados".` : `Lote restaurado: ${label}`); setOpen(false); },
    onError: toastError,
  });
  const del = useMutation({
    mutationFn: () => api.del<{ total: number }>(`/api/batches/${b.id}`),
    onSuccess: (r) => { invalidate(); setConfirm(false); toast(`Lote excluído: ${label} (${r?.total ?? b.total} arte${(r?.total ?? b.total) !== 1 ? 's' : ''})`); if (afterDelete === 'home') nav('/app'); },
    onError: toastError,
  });

  // lote em aprovação com arte pendente: cliente pode estar com o link aberto → exige digitar o nome do cliente
  const risky = !!b.link_sent_at && b.pending > 0 && !b.submitted_at;
  const canDelete = !risky || typed.trim().toLowerCase() === b.client_name.trim().toLowerCase();
  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };

  return (
    <span onClick={stop} className="relative inline-flex">
      {variant === 'buttons' ? (
        <span className="flex gap-2">
          <Button variant="secondary" onClick={() => archive.mutate(!archived)} loading={archive.isPending}>{archived ? 'Restaurar' : 'Arquivar'}</Button>
          <Button variant="ghost" className="text-red-600" onClick={() => { setTyped(''); setConfirm(true); }}>Excluir</Button>
        </span>
      ) : (
        <>
          <button type="button" aria-label="Mais ações" onClick={() => setOpen((o) => !o)} className="rounded-md px-1.5 text-lg leading-none text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800">⋯</button>
          {open && (
            <>
              <span className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-7 z-40 w-48 overflow-hidden rounded-lg bg-white py-1 text-sm shadow-lg ring-1 ring-neutral-200">
                <button type="button" onClick={() => archive.mutate(!archived)} className="block w-full px-3 py-2 text-left hover:bg-neutral-50">{archived ? 'Restaurar para o Kanban' : 'Arquivar (ocultar)'}</button>
                <button type="button" onClick={() => { setOpen(false); setTyped(''); setConfirm(true); }} className="block w-full px-3 py-2 text-left text-red-600 hover:bg-red-50">Excluir definitivamente</button>
              </div>
            </>
          )}
        </>
      )}

      {/* Portal: no Kanban este componente vive dentro do <Link> do card. Um clique dentro do modal
          subiria nativamente até o <a> e navegaria para o lote, mesmo com stopPropagation no React. */}
      {createPortal(<Modal open={confirm} onClose={() => setConfirm(false)} title="Excluir lote?">
        <div className="space-y-3 text-sm">
          <div className="rounded-lg bg-neutral-50 p-3"><b>{label}</b><div className="text-neutral-500">{b.total} arte{b.total !== 1 && 's'}{b.pending > 0 && ` · ${b.pending} pendente${b.pending > 1 ? 's' : ''}`}</div></div>
          <p className="text-neutral-700">Vão embora de vez: artes e arquivos, versões, respostas do cliente, feedback e o histórico deste lote. O link de aprovação para de funcionar na hora.</p>
          {!archived && <p className="text-neutral-500">Se a ideia é só limpar o Kanban, prefira <button type="button" className="font-medium text-neutral-900 underline" onClick={() => { setConfirm(false); archive.mutate(true); }}>arquivar</button>: some da tela e continua no banco.</p>}
          {risky && (
            <div className="rounded-lg bg-red-50 p-3 text-red-800 ring-1 ring-red-200">
              <b>Atenção:</b> o link já foi enviado e o cliente ainda não respondeu tudo. Para confirmar, digite o nome do cliente: <b>{b.client_name}</b>
              <input value={typed} onChange={(e) => setTyped(e.target.value)} className="mt-2 w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-red-500" placeholder={b.client_name} />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setConfirm(false)}>Cancelar</Button>
            <Button variant="danger" onClick={() => del.mutate()} disabled={!canDelete} loading={del.isPending}>Excluir definitivamente</Button>
          </div>
        </div>
      </Modal>, document.body)}
    </span>
  );
}

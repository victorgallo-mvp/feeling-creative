import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { RejectReason } from '../api/types';
import { REASON_LABEL } from '../lib/format';

const REASONS = Object.keys(REASON_LABEL) as RejectReason[];

export function RejectModal({ open, onCancel, onConfirm, busy }: { open: boolean; onCancel: () => void; onConfirm: (r: RejectReason, comment: string) => void; busy?: boolean }) {
  const [reason, setReason] = useState<RejectReason | null>(null);
  const [comment, setComment] = useState('');
  useEffect(() => { if (open) { setReason(null); setComment(''); } }, [open]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}>
          <motion.div className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl"
            initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }} transition={{ type: 'spring', damping: 28, stiffness: 320 }} onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-neutral-200 sm:hidden" />
            <h2 className="text-lg font-semibold">O que precisa mudar?</h2>
            <p className="mb-3 text-sm text-neutral-500">Escolha o motivo. Se quiser, explique melhor para o designer.</p>
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map((r) => (
                <button key={r} onClick={() => setReason(r)} className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${reason === r ? 'border-red-500 bg-red-50 text-red-700' : 'border-neutral-200 bg-white text-neutral-700 active:bg-neutral-50'}`}>{REASON_LABEL[r]}</button>
              ))}
            </div>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comentário (opcional): ex. trocar a foto por uma mais clara"
              className="mt-3 min-h-20 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-900" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={onCancel} className="rounded-xl border border-neutral-200 py-3 text-sm font-medium">Cancelar</button>
              <button onClick={() => reason && onConfirm(reason, comment)} disabled={!reason || busy} className="rounded-xl bg-red-600 py-3 text-sm font-semibold text-white disabled:opacity-40">Confirmar recusa</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

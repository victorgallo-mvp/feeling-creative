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
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}>
          <motion.div className="w-full max-w-md rounded-t-3xl bg-neutral-950 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-white shadow-2xl ring-1 ring-white/10 sm:rounded-3xl"
            initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }} transition={{ type: 'spring', damping: 28, stiffness: 320 }} onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
            <h2 className="display text-2xl">O que precisa mudar?</h2>
            <p className="mb-3 text-sm text-neutral-400">Escolha o motivo. Se quiser, explique melhor para o designer.</p>
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map((r) => (
                <button key={r} onClick={() => setReason(r)} className={`rounded-xl border px-3 py-3 text-sm font-medium transition ${reason === r ? 'border-red-500 bg-red-500/15 text-red-300' : 'border-white/15 bg-white/5 text-neutral-200 active:bg-white/10'}`}>{REASON_LABEL[r]}</button>
              ))}
            </div>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comentário (opcional): ex. trocar a foto por uma mais clara"
              className="mt-3 min-h-20 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-brand-500" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={onCancel} className="rounded-xl border border-white/15 py-3 text-sm font-medium text-neutral-200">Cancelar</button>
              <button onClick={() => reason && onConfirm(reason, comment)} disabled={!reason || busy} className="rounded-xl bg-red-600 py-3 text-sm font-semibold text-white disabled:opacity-40">Confirmar recusa</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

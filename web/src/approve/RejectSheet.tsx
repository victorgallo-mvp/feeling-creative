import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { RejectReason } from '../api/types';
import { REASON_LABEL } from '../lib/format';

const REASONS = Object.keys(REASON_LABEL) as RejectReason[];

/**
 * Painel de recusa que abre e minimiza. Sem fundo escuro e sem camada por cima: é só uma folha
 * presa ao rodapé. Expandida, mostra motivo + comentário; minimizada, vira uma barra fina e a
 * publicação fica inteira à vista e interativa (rolar legenda, passar lâminas). O que já foi
 * preenchido não se perde ao minimizar. `onMinimized` avisa o pai para devolver o card ao
 * tamanho normal enquanto a folha está minimizada.
 */
export function RejectSheet({ open, title, onCancel, onConfirm, onMinimized, onHeight, busy }: {
  open: boolean; title?: string; onCancel: () => void; onConfirm: (r: RejectReason, comment: string) => void;
  onMinimized?: (min: boolean) => void; onHeight?: (h: number) => void; busy?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  // altura real da folha (expandida ou minimizada) para o pai encaixar o card logo acima
  useEffect(() => {
    if (!open) { onHeight?.(0); return; }
    const el = rootRef.current; if (!el) return;
    const report = () => onHeight?.(el.getBoundingClientRect().height);
    report();
    const ro = new ResizeObserver(report); ro.observe(el);
    return () => { ro.disconnect(); onHeight?.(0); };
  }, [open]);
  const [reason, setReason] = useState<RejectReason | null>(null);
  const [comment, setComment] = useState('');
  const [min, setMin] = useState(false);
  useEffect(() => { if (open) { setReason(null); setComment(''); setMin(false); } }, [open]);
  useEffect(() => { onMinimized?.(open && min); }, [open, min]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={rootRef}
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md px-2 pb-[env(safe-area-inset-bottom)]"
          initial={{ y: 160, opacity: 0 }} animate={{ y: 0, opacity: 1, pointerEvents: 'auto' }} exit={{ y: 160, opacity: 0, pointerEvents: 'none', transition: { duration: 0.15 } }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}>
          <div className="overflow-hidden rounded-2xl bg-neutral-950 text-white shadow-[0_-10px_40px_rgba(0,0,0,.7)] ring-1 ring-white/15">
            {/* cabeçalho: sempre visível; na barra minimizada é tudo o que aparece */}
            <button type="button" onClick={() => setMin((m) => !m)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left">
              <span className="display text-lg">{min ? 'Recusa em andamento' : (title ?? 'O que precisa mudar?')}</span>
              {min && reason && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-medium text-red-300">{REASON_LABEL[reason]}</span>}
              <span className="flex-1" />
              <span className="rounded-full border border-white/20 px-2.5 py-0.5 text-[11px] font-medium text-neutral-300">{min ? '▲ continuar' : '▼ minimizar e ver a publicação'}</span>
            </button>

            <motion.div initial={false} animate={{ height: min ? 0 : 'auto' }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="max-h-[52vh] overflow-y-auto px-4 pb-4 no-scrollbar">
                <div className="grid grid-cols-2 gap-1.5">
                  {REASONS.map((r) => (
                    <button key={r} type="button" onClick={() => setReason(r)} className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${reason === r ? 'border-red-500 bg-red-500/15 text-red-300' : 'border-white/15 bg-white/5 text-neutral-200 active:bg-white/10'}`}>{REASON_LABEL[r]}</button>
                  ))}
                </div>
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comentário (opcional): ex. trocar a foto por uma mais clara"
                  className="mt-2 min-h-16 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-brand-500" />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" onClick={onCancel} className="rounded-xl border border-white/15 py-2.5 text-sm font-medium text-neutral-200">Cancelar</button>
                  <button type="button" onClick={() => reason && onConfirm(reason, comment)} disabled={!reason || busy} className="rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Confirmar recusa</button>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

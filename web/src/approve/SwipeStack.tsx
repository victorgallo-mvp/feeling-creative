import { useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import type { PublicCreative, RejectReason } from '../api/types';
import { PostCard } from './PostCard';
import { RejectModal } from './RejectModal';

type ClientInfo = { name: string; logo_url: string | null; instagram_handle: string | null };
const THRESHOLD = 110;

export function SwipeStack({ items, client, onDecide }: {
  items: PublicCreative[]; client: ClientInfo;
  onDecide: (c: PublicCreative, action: 'approved' | 'rejected', reason?: RejectReason, comment?: string) => Promise<void> | void;
}) {
  const [exit, setExit] = useState<'left' | 'right' | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const top = items[0];
  const next = items[1];

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-250, 250], [-14, 14]);
  const okOpacity = useTransform(x, [30, THRESHOLD], [0, 1]);
  const noOpacity = useTransform(x, [-THRESHOLD, -30], [1, 0]);
  const bg = useTransform(x, [-THRESHOLD, 0, THRESHOLD], ['rgba(239,68,68,0.12)', 'rgba(0,0,0,0)', 'rgba(16,185,129,0.12)']);

  const finish = async (action: 'approved' | 'rejected', reason?: RejectReason, comment?: string) => {
    if (!top || busy) return;
    setBusy(true);
    setExit(action === 'approved' ? 'right' : 'left');
    try { await onDecide(top, action, reason, comment); } finally { setBusy(false); setRejecting(false); x.set(0); }
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const dx = info.offset.x + info.velocity.x * 0.15;
    if (dx > THRESHOLD) finish('approved');
    else if (dx < -THRESHOLD) setRejecting(true);
  };

  if (!top) return null;

  return (
    <div className="relative flex flex-1 flex-col">
      <motion.div className="pointer-events-none absolute inset-0 -z-10 rounded-3xl" style={{ background: bg }} />
      <div className="relative flex-1">
        {next && (
          <div className="absolute inset-0 scale-[0.95] translate-y-3 opacity-60">
            <PostCard key={`next-${next.id}-${next.version}`} c={next} client={client} compact />
          </div>
        )}
        <AnimatePresence initial={false} onExitComplete={() => setExit(null)}>
          <motion.div
            key={`${top.id}-${top.version}`}
            className="absolute inset-0 cursor-grab active:cursor-grabbing touch-pan-y"
            style={{ x, rotate }}
            drag={!rejecting && !busy ? 'x' : false}
            dragSnapToOrigin
            dragElastic={0.9}
            onDragEnd={onDragEnd}
            initial={{ scale: 0.95, y: 12, opacity: 0.6 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ x: exit === 'right' ? 500 : exit === 'left' ? -500 : 0, rotate: exit === 'right' ? 18 : -18, opacity: 0, transition: { duration: 0.3 } }}
            transition={{ type: 'spring', damping: 22, stiffness: 260 }}
          >
            <PostCard c={top} client={client} />
            <motion.div style={{ opacity: okOpacity }} className="pointer-events-none absolute left-4 top-5 -rotate-12 rounded-lg border-4 border-emerald-500 px-3 py-1 text-2xl font-black uppercase tracking-wider text-emerald-500">Aprovar</motion.div>
            <motion.div style={{ opacity: noOpacity }} className="pointer-events-none absolute right-4 top-5 rotate-12 rounded-lg border-4 border-red-500 px-3 py-1 text-2xl font-black uppercase tracking-wider text-red-500">Recusar</motion.div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-3 flex items-center justify-center gap-8 pb-[env(safe-area-inset-bottom)]">
        <button aria-label="Recusar" onClick={() => setRejecting(true)} disabled={busy} className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl text-red-500 shadow-lg ring-1 ring-black/5 transition active:scale-90 disabled:opacity-50">✕</button>
        <div className="text-center text-[11px] leading-tight text-neutral-400">arraste<br />← recusar · aprovar →</div>
        <button aria-label="Aprovar" onClick={() => finish('approved')} disabled={busy} className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl text-emerald-500 shadow-lg ring-1 ring-black/5 transition active:scale-90 disabled:opacity-50">✓</button>
      </div>

      <RejectModal open={rejecting} busy={busy} onCancel={() => { setRejecting(false); x.set(0); }} onConfirm={(r, c) => finish('rejected', r, c)} />
    </div>
  );
}

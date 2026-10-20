import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import type { PublicCreative, RejectReason } from '../api/types';
import { PostCard } from './PostCard';
import { RejectModal } from './RejectModal';

type ClientInfo = { name: string; logo_url: string | null; instagram_handle: string | null };

/**
 * Regras do gesto (calibradas para celular):
 * - A decisão depende da DISTÂNCIA arrastada em relação à largura do card, não da velocidade.
 *   Soltar além de 40% da largura decide. Um "flick" rápido (> 1200 px/s) decide a partir de 22%.
 * - dragDirectionLock: se o dedo começa indo para cima/baixo (ler a legenda, rolar), o card não anda.
 * - Sem momentum: ao soltar antes do limite o card volta ao centro, sem "escapar".
 */
const DECIDE_RATIO = 0.4;
const FLICK_RATIO = 0.22;
const FLICK_VELOCITY = 1200;

export function SwipeStack({ items, client, onDecide }: {
  items: PublicCreative[]; client: ClientInfo;
  onDecide: (c: PublicCreative, action: 'approved' | 'rejected', reason?: RejectReason, comment?: string) => Promise<void> | void;
}) {
  const [exit, setExit] = useState<'left' | 'right' | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const areaRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);
  const top = items[0];
  const next = items[1];

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth || 360);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const decideAt = width * DECIDE_RATIO;
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-width, width], [-12, 12]);
  const okOpacity = useTransform(x, [decideAt * 0.25, decideAt], [0, 1]);
  const noOpacity = useTransform(x, [-decideAt, -decideAt * 0.25], [1, 0]);
  const bg = useTransform(x, [-decideAt, 0, decideAt], ['rgba(239,68,68,0.14)', 'rgba(0,0,0,0)', 'rgba(16,185,129,0.14)']);

  const finish = async (action: 'approved' | 'rejected', reason?: RejectReason, comment?: string) => {
    if (!top || busy) return;
    setBusy(true);
    setExit(action === 'approved' ? 'right' : 'left');
    try { await onDecide(top, action, reason, comment); } finally { setBusy(false); setRejecting(false); x.set(0); }
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const dx = info.offset.x;
    const vx = info.velocity.x;
    const sameDir = Math.sign(dx) === Math.sign(vx);
    const far = Math.abs(dx) >= decideAt;
    const flick = sameDir && Math.abs(vx) >= FLICK_VELOCITY && Math.abs(dx) >= width * FLICK_RATIO;
    if (!far && !flick) return; // volta ao centro (dragSnapToOrigin)
    if (dx > 0) finish('approved');
    else setRejecting(true);
  };

  if (!top) return null;

  return (
    <div className="relative flex flex-1 flex-col">
      <motion.div className="pointer-events-none absolute inset-0 -z-10 rounded-3xl" style={{ background: bg }} />
      <div ref={areaRef} className="relative flex-1">
        {next && (
          <div className="absolute inset-0 scale-[0.95] translate-y-3 opacity-60">
            <PostCard key={`next-${next.id}-${next.version}`} c={next} client={client} compact />
          </div>
        )}
        <AnimatePresence initial={false} onExitComplete={() => setExit(null)}>
          <motion.div
            key={`${top.id}-${top.version}`}
            className="absolute inset-0 cursor-grab active:cursor-grabbing"
            style={{ x, rotate, touchAction: 'pan-y' }}
            drag={!rejecting && !busy ? 'x' : false}
            dragDirectionLock
            dragSnapToOrigin
            dragMomentum={false}
            dragElastic={1}
            dragTransition={{ bounceStiffness: 500, bounceDamping: 40 }}
            onDragEnd={onDragEnd}
            initial={{ scale: 0.95, y: 12, opacity: 0.6 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ x: exit === 'right' ? width * 1.5 : exit === 'left' ? -width * 1.5 : 0, rotate: exit === 'right' ? 18 : -18, opacity: 0, transition: { duration: 0.28 } }}
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

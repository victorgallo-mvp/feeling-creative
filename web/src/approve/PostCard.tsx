import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { PublicCreative } from '../api/types';
import { Avatar } from '../components/ui';
import { TYPE_LABEL } from '../lib/format';
import { StoryCard } from './StoryCard';
import { ArrowButton, CarouselIndicator } from '../components/CarouselArrows';

function fmtLong(iso: string | null) {
  if (!iso) return null;
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'long' });
}

export function PostCard({ c, client, compact }: { c: PublicCreative; client: { name: string; logo_url: string | null; instagram_handle: string | null }; compact?: boolean }) {
  const [slide, setSlide] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const asset = c.assets[slide] ?? c.assets[0];
  const long = c.caption.length > 110;
  if (c.type === 'story') return <StoryCard c={c} client={client} />;

  return (
    <div className="flex h-full w-full select-none flex-col overflow-y-auto overflow-x-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/5 no-scrollbar">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <Avatar src={client.logo_url} name={client.name} size={32} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-semibold">{client.instagram_handle ? `@${client.instagram_handle}` : client.name}</div>
          <div className="truncate text-[11px] text-neutral-500">{TYPE_LABEL[c.type]}{c.scheduled_date && ` · ${fmtLong(c.scheduled_date)}`}</div>
        </div>
        <span className="text-neutral-400">•••</span>
      </div>

      <div className="relative aspect-[4/5] w-full shrink-0 overflow-hidden bg-neutral-100">
        {asset?.mime.startsWith('video') ? (
          <video src={asset.url} controls playsInline preload="metadata" className="h-full w-full object-contain" onPointerDownCapture={(e) => e.stopPropagation()} />
        ) : (
          <AnimatePresence initial={false} mode="popLayout">
            <motion.img key={asset?.id} src={asset?.url} draggable={false} className="absolute inset-0 h-full w-full object-cover"
              initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.18 }} />
          </AnimatePresence>
        )}
        {c.assets.length > 1 && (
          <>
            <ArrowButton dir="prev" onClick={() => setSlide((s) => Math.max(0, s - 1))} disabled={slide === 0} size={compact ? 'sm' : 'md'} className="absolute left-2 top-1/2 -translate-y-1/2" />
            <ArrowButton dir="next" onClick={() => setSlide((s) => Math.min(c.assets.length - 1, s + 1))} disabled={slide === c.assets.length - 1} size={compact ? 'sm' : 'md'} nudge={!compact && slide === 0} className="absolute right-2 top-1/2 -translate-y-1/2" />
            <CarouselIndicator index={slide} total={c.assets.length} />
          </>
        )}
      </div>

      <div className="flex items-center gap-4 px-3 pt-2 text-neutral-800">
        <HeartIcon /><CommentIcon /><SendIcon /><span className="flex-1" /><BookmarkIcon />
      </div>
      <div className={`px-3 pb-3 pt-1.5 text-sm ${compact ? '' : 'min-h-14'}`}>
        <span className="font-semibold">{client.instagram_handle ? client.instagram_handle : client.name} </span>
        <span className="whitespace-pre-wrap text-neutral-800">{expanded || !long ? c.caption : c.caption.slice(0, 110).trimEnd() + '…'}</span>
        {long && !expanded && <button onClick={() => setExpanded(true)} onPointerDownCapture={(e) => e.stopPropagation()} className="ml-1 text-neutral-500">ver mais</button>}
        {!c.caption && <span className="italic text-neutral-400">sem legenda</span>}
      </div>
    </div>
  );
}

const I = (d: string) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
const HeartIcon = () => I('M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z');
const CommentIcon = () => I('M21 11.5a8.4 8.4 0 0 1-9 8.4 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 1 1 21 11.5z');
const SendIcon = () => I('M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z');
const BookmarkIcon = () => I('M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z');

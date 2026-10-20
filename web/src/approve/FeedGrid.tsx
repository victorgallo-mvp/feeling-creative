import type { PublicCreative } from '../api/types';

/**
 * Mock da grade do feed: 3 colunas, artes (exceto stories) ordenadas por data prevista, mais recente no topo.
 * Preparado para, no futuro, receber `extra` com posts antigos do perfil para intercalar.
 */
export function FeedGrid({ creatives, extra = [], onOpen }: { creatives: PublicCreative[]; extra?: { id: string; thumb_url: string; scheduled_date: string | null }[]; onOpen?: (c: PublicCreative) => void }) {
  const items = [
    ...creatives.filter((c) => c.type !== 'story').map((c) => ({ key: `c${c.id}`, date: c.scheduled_date ?? '0000-00-00', thumb: c.assets[0]?.thumb_url ?? c.assets[0]?.url, video: c.assets[0]?.mime.startsWith('video'), carousel: c.assets.length > 1, status: c.status, c })),
    ...extra.map((e) => ({ key: e.id, date: e.scheduled_date ?? '0000-00-00', thumb: e.thumb_url, video: false, carousel: false, status: 'old' as const, c: null })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  if (!items.length) return <div className="p-8 text-center text-sm text-neutral-500">Nenhum post para mostrar na grade (stories não entram).</div>;

  return (
    <div className="grid grid-cols-3 gap-0.5">
      {items.map((it) => (
        <button key={it.key} onClick={() => it.c && onOpen?.(it.c)} className="relative aspect-[4/5] overflow-hidden bg-neutral-200">
          {it.video ? <video src={it.thumb} muted preload="metadata" className="h-full w-full object-cover" /> : <img src={it.thumb} className="h-full w-full object-cover" loading="lazy" />}
          {it.carousel && <span className="absolute right-1 top-1 text-white drop-shadow">▣</span>}
          {it.video && <span className="absolute right-1 top-1 text-white drop-shadow">▶</span>}
          {it.status === 'rejected' && <span className="absolute inset-0 bg-red-600/50" />}
          {it.status === 'pending' && <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">pendente</span>}
          {(it.status === 'approved' || it.status === 'auto_approved') && <span className="absolute bottom-1 left-1 rounded bg-emerald-600/90 px-1 text-[10px] text-white">✓</span>}
        </button>
      ))}
    </div>
  );
}

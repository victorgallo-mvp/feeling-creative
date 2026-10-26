import { useEffect, useState } from 'react';
import type { PublicCreative } from '../api/types';
import { Avatar } from '../components/ui';

type ClientInfo = { name: string; logo_url: string | null; instagram_handle: string | null };

/**
 * Prévia de story como o Instagram mostra: tela cheia 9:16, barra de progresso segmentada no topo,
 * cabeçalho sobreposto (avatar, @, "agora"), vídeo em autoplay mudo e barra de resposta no rodapé.
 * Vários arquivos = sequência de stories: toque na metade direita avança, esquerda volta.
 * A legenda (se houver) aparece como texto de apoio no rodapé, não como legenda de feed.
 */
export function StoryCard({ c, client }: { c: PublicCreative; client: ClientInfo }) {
  const [i, setI] = useState(0);
  const asset = c.assets[i] ?? c.assets[0];
  const n = c.assets.length;
  useEffect(() => setI(0), [c.id, c.version]);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const go = (d: -1 | 1) => setI((s) => Math.min(n - 1, Math.max(0, s + d)));

  return (
    <div className="mx-auto flex h-full w-full items-center justify-center">
      <div className="relative aspect-[9/16] max-h-full max-w-full select-none overflow-hidden rounded-2xl bg-black shadow-xl ring-1 ring-white/10">
        {asset?.mime.startsWith('video') ? (
          <video key={asset.id} src={asset.url} autoPlay muted loop playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <img key={asset?.id} src={asset?.url} draggable={false} className="absolute inset-0 h-full w-full object-cover" />
        )}
        {/* sombras para leitura do topo e do rodapé */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/60 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/60 to-transparent" />

        {/* progresso segmentado */}
        <div className="absolute inset-x-2 top-2 flex gap-1">
          {c.assets.map((a, k) => <span key={a.id} className={`h-0.5 flex-1 rounded-full ${k <= i ? 'bg-white' : 'bg-white/35'}`} />)}
        </div>
        {/* cabeçalho */}
        <div className="absolute inset-x-3 top-4 flex items-center gap-2 text-white">
          <Avatar src={client.logo_url} name={client.name} size={30} />
          <span className="truncate text-sm font-semibold drop-shadow">{client.instagram_handle ? client.instagram_handle : client.name}</span>
          <span className="text-xs text-white/70">agora</span>
          <span className="flex-1" />
          <span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/90">Story{n > 1 ? ` ${i + 1}/${n}` : ''}</span>
        </div>

        {/* zonas de toque p/ navegar na sequência (não interferem no swipe: só clique) */}
        {n > 1 && (
          <>
            <button aria-label="Anterior" onClick={(e) => { stop(e); go(-1); }} className="absolute inset-y-16 left-0 w-1/3" />
            <button aria-label="Próximo" onClick={(e) => { stop(e); go(1); }} className="absolute inset-y-16 right-0 w-1/3" />
          </>
        )}

        {/* rodapé: texto de apoio + barra de resposta */}
        <div className="absolute inset-x-3 bottom-3 flex flex-col gap-2">
          {c.caption && <p className="line-clamp-3 text-center text-xs text-white/90 drop-shadow">{c.caption}</p>}
          <div className="flex items-center gap-3 text-white">
            <div className="flex-1 rounded-full border border-white/50 px-3 py-1.5 text-xs text-white/70">Enviar mensagem</div>
            <HeartIcon /><SendIcon />
          </div>
        </div>
      </div>
    </div>
  );
}

const I = (d: string) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
const HeartIcon = () => I('M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z');
const SendIcon = () => I('M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z');

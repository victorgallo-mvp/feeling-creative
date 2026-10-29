/**
 * Seta de carrossel: botão redondo preto translúcido com borda branca e chevron em SVG,
 * legível sobre qualquer foto. `nudge` faz um pulso curto nas primeiras vezes que aparece,
 * para indicar que há mais lâminas. A troca de lâmina é só por botão (sem deslizar),
 * para não confundir com o swipe de aprovar/recusar.
 */
export function ArrowButton({ dir, onClick, disabled, size = 'md', nudge, className = '' }: {
  dir: 'prev' | 'next'; onClick: () => void; disabled?: boolean; size?: 'sm' | 'md'; nudge?: boolean; className?: string;
}) {
  const dim = size === 'sm' ? 'h-8 w-8' : 'h-11 w-11';
  const icon = size === 'sm' ? 16 : 22;
  return (
    <button
      type="button"
      aria-label={dir === 'prev' ? 'Lâmina anterior' : 'Próxima lâmina'}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClick(); }}
      onPointerDownCapture={(e) => e.stopPropagation()}
      disabled={disabled}
      className={`flex ${dim} items-center justify-center rounded-full bg-black/70 text-white shadow-lg ring-2 ring-white/90 backdrop-blur transition active:scale-90 disabled:pointer-events-none disabled:opacity-0 ${nudge && !disabled ? (dir === 'next' ? 'animate-nudge-right' : 'animate-nudge-left') : ''} ${className}`}
    >
      <svg width={icon} height={icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {dir === 'prev' ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}
      </svg>
    </button>
  );
}

/** Contador "2/5" + pontinhos (atual em verde Feeling). */
export function CarouselIndicator({ index, total, className = '' }: { index: number; total: number; className?: string }) {
  return (
    <>
      <div className={`absolute right-2 top-2 rounded-full bg-black/75 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-white/30 ${className}`}>{index + 1}/{total}</div>
      <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
        {Array.from({ length: total }).map((_, i) => <span key={i} className={`h-2 w-2 rounded-full ring-1 ring-black/30 ${i === index ? 'bg-brand-500' : 'bg-white/80'}`} />)}
      </div>
    </>
  );
}

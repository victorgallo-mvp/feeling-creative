import { toast } from './toastStore';

/** Botões "Abrir" e "Copiar" para o link de aprovação do cliente. Usado na lista de clientes, no Kanban e na página do cliente. */
export async function copyText(text: string, what = 'Link') {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${what} copiado`);
  } catch {
    // Safari antigo / contexto sem permissão: fallback com textarea
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    toast(ok ? `${what} copiado` : 'Não foi possível copiar. Selecione o link manualmente.', ok ? 'info' : 'error');
  }
}

export function LinkActions({ link, size = 'md', waUrl }: { link: string; size?: 'sm' | 'md'; waUrl?: string | null }) {
  const cls = size === 'sm'
    ? 'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium'
    : 'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium';
  const stop = (e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); };
  return (
    <span className="inline-flex flex-wrap items-center gap-1" onClick={stop}>
      <a href={link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className={`${cls} bg-black text-white hover:bg-neutral-800`} title={link}>Abrir ↗</a>
      <button type="button" onClick={(e) => { stop(e); copyText(link); }} className={`${cls} border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-100`}>Copiar</button>
      {waUrl && <a href={waUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className={`${cls} bg-brand-500 text-black hover:bg-brand-400`}>WhatsApp</a>}
    </span>
  );
}

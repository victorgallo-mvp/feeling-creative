import { type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export function Button({ variant = 'primary', className, loading, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed';
  const v: Record<Variant, string> = {
    primary: 'bg-brand-500 text-black hover:bg-brand-400 font-semibold',
    secondary: 'bg-white border border-neutral-300 text-neutral-800 hover:bg-neutral-100',
    ghost: 'text-neutral-700 hover:bg-neutral-100',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    success: 'bg-black text-white hover:bg-neutral-800',
  };
  return (
    <button className={cx(base, v[variant], className)} disabled={loading || props.disabled} {...props}>
      {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-neutral-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-neutral-500">{hint}</span>}
    </label>
  );
}

const inputCls = 'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-500/25';
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(inputCls, p.className)} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(inputCls, p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={cx(inputCls, 'min-h-24', p.className)} />;

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; wide?: boolean }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            className={cx('max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-md')}
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            {title && <h2 className="mb-4 text-lg font-semibold">{title}</h2>}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'red' | 'amber' | 'blue' }) {
  const t = {
    neutral: 'bg-neutral-100 text-neutral-700', green: 'bg-brand-100 text-brand-900', red: 'bg-red-100 text-red-800',
    amber: 'bg-amber-100 text-amber-800', blue: 'bg-sky-100 text-sky-800',
  }[tone];
  return <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', t)}>{children}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return <div className={cx('h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-500', className)} />;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">{children}</div>;
}

export function Avatar({ src, name, size = 36 }: { src: string | null | undefined; name: string; size?: number }) {
  const initials = name.split(' ').slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  return src
    ? <img src={src} alt={name} style={{ width: size, height: size }} className="rounded-full object-cover" />
    : <div style={{ width: size, height: size, fontSize: size * 0.38 }} className="flex items-center justify-center rounded-full bg-black font-semibold text-brand-400 ring-1 ring-brand-500/50">{initials}</div>;
}

/** Nota de 1 a 5 estrelas. Somente leitura (painel) ou interativa (link do cliente) quando recebe onChange. */
export function Stars({ value, onChange, size = 18, className }: { value: number; onChange?: (v: number) => void; size?: number; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-0.5', className)} role={onChange ? 'radiogroup' : undefined} aria-label={`${value} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= value;
        const el = (
          <svg key={n} width={size} height={size} viewBox="0 0 24 24" className={cx('transition', on ? 'text-brand-500' : onChange ? 'text-neutral-600' : 'text-neutral-300')} fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
            <path d="M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.8L12 17.7 5.9 21l1.3-6.8-5-4.7 6.8-.8z" />
          </svg>
        );
        return onChange
          ? <button key={n} type="button" role="radio" aria-checked={n === value} aria-label={`${n} estrela${n > 1 ? 's' : ''}`} onClick={() => onChange(n)} className="rounded p-0.5 active:scale-90">{el}</button>
          : el;
      })}
    </span>
  );
}

/** Logo da Feeling. Versão para fundo escuro (lettering branco) ou claro (lettering preto). Abaixo de ~220px de largura o manual pede o símbolo isolado. */
export function Logo({ on = 'dark', variant = 'full', className }: { on?: 'dark' | 'light'; variant?: 'full' | 'symbol'; className?: string }) {
  if (variant === 'symbol') return <img src="/brand/symbol.png" alt="Feeling" className={cx('h-8 w-auto', className)} draggable={false} />;
  return <img src={on === 'dark' ? '/brand/logo-dark-bg.png' : '/brand/logo-light-bg.png'} alt="Feeling Marketing Digital" className={cx('h-9 w-auto', className)} draggable={false} />;
}

/** Título de página no padrão da marca (Big Shoulders, caixa alta). */
export function PageTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h1 className={cx('display text-3xl text-black', className)}>{children}</h1>;
}

/** Toasts simples, globais. */
import { create } from './toastStore';
export function Toaster() {
  const toasts = create.use();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(0.75rem+env(safe-area-inset-top))] z-[60] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
            className={cx('rounded-lg px-4 py-2 text-sm shadow-lg', t.kind === 'error' ? 'bg-red-600 text-white' : 'bg-black text-white ring-1 ring-brand-500/60')}>
            {t.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

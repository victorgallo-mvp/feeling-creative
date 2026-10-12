import { useSyncExternalStore } from 'react';

interface Toast { id: number; message: string; kind: 'info' | 'error' }
let toasts: Toast[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(message: string, kind: 'info' | 'error' = 'info') {
  const id = Date.now() + Math.random();
  toasts = [...toasts, { id, message, kind }];
  emit();
  setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); emit(); }, 3500);
}
export const toastError = (e: unknown) => toast(e instanceof Error ? e.message : 'Erro inesperado', 'error');

export const create = {
  use: () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => toasts),
};

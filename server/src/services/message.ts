import { one } from '../db.js';
import { config } from '../config.js';

const MONTHS_PT = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
export function batchLabel(b: { month: number; year: number; title?: string | null }) {
  const base = `${MONTHS_PT[b.month - 1]} de ${b.year}`;
  return b.title ? `${b.title} (${base})` : base;
}

export const DEFAULT_TEMPLATE =
  'Oi, {cliente}! Tudo bem? As {qtd_artes} artes do mês já estão prontas para sua aprovação. É só abrir o link, deslizar para aprovar ou recusar cada uma: {link}';

export function publicLink(token: string) {
  return `${config.frontendUrl}/a/${token}`;
}

export async function buildMessage(opts: { clientName: string; token: string; count: number; batchLabel?: string }) {
  const row = await one<{ value: string }>(`SELECT value FROM settings WHERE key = 'whatsapp_template'`);
  const template = row?.value || DEFAULT_TEMPLATE;
  const link = publicLink(opts.token);
  const text = template
    .replaceAll('{cliente}', opts.clientName)
    .replaceAll('{link}', link)
    .replaceAll('{qtd_artes}', String(opts.count))
    .replaceAll('{lote}', opts.batchLabel ?? '');
  return { link, text };
}

export function waUrl(whatsapp: string | null, text: string) {
  const digits = (whatsapp || '').replace(/\D/g, '');
  const base = digits ? `https://wa.me/${digits}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(text)}`;
}

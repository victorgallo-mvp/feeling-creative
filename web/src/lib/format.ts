import type { CreativeType, CreativeStatus, KanbanStatus, RejectReason } from '../api/types';

export const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const monthLabel = (m: number, y: number) => `${MONTHS[m - 1]}/${y}`;

export const TYPE_LABEL: Record<CreativeType, string> = { estatica: 'Estática', carrossel: 'Carrossel', story: 'Story', video: 'Vídeo' };
export const STATUS_LABEL: Record<CreativeStatus, string> = { pending: 'Pendente', approved: 'Aprovada', rejected: 'Recusada', auto_approved: 'Auto-aprovada' };
export const KANBAN_LABEL: Record<KanbanStatus, string> = { briefing: 'Briefing', em_producao: 'Em produção', enviado_aprovacao: 'Enviado para aprovação', aprovado: 'Aprovado', programado: 'Programado' };
export const REASON_LABEL: Record<RejectReason, string> = { texto_legenda: 'Texto / legenda', identidade_visual: 'Identidade visual', imagem: 'Imagem', outro: 'Outro' };

export const EVENT_LABEL: Record<string, string> = {
  batch_created: 'Lote criado', batch_archived: 'Lote arquivado', batch_unarchived: 'Lote restaurado', kanban_moved: 'Movido no Kanban', link_sent: 'Link enviado ao cliente', link_viewed: 'Link aberto pelo cliente',
  batch_submitted: 'Cliente enviou a aprovação', creative_uploaded: 'Arte enviada', version_uploaded: 'Nova versão enviada', creative_edited: 'Legenda/tipo editados',
  creative_approved: 'Aprovada pelo cliente', creative_rejected: 'Recusada pelo cliente', creative_auto_approved: 'Auto-aprovada (prazo)',
  creative_decision_changed: 'Cliente mudou a resposta',
};

export function fmtDate(iso: string | null | undefined, withTime = false) {
  if (!iso) return '—';
  const d = iso.length === 10 ? new Date(iso + 'T12:00:00') : new Date(iso);
  return d.toLocaleDateString('pt-BR', withTime ? { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: 'short' });
}

export function daysAgo(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

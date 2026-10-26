export type Role = 'designer' | 'gestor';
export interface User { id: number; name: string; email: string; role: Role }

export type KanbanStatus = 'briefing' | 'em_producao' | 'enviado_aprovacao' | 'aprovado' | 'programado';
export type CreativeType = 'estatica' | 'carrossel' | 'story' | 'video';
export type CreativeStatus = 'pending' | 'approved' | 'rejected' | 'auto_approved';
export type RejectReason = 'texto_legenda' | 'identidade_visual' | 'imagem' | 'outro';

export interface Client {
  id: number; name: string; logo_url: string | null; instagram_handle: string | null; whatsapp: string | null;
  designer_id: number | null; manager_id: number | null; designer_name?: string | null; manager_name?: string | null;
  auto_approve_enabled: boolean; auto_approve_days: number;
  feedback_avg: number | null; feedback_count: number;
  last_feedback: { rating: number; comment: string | null; at: string; month: number; year: number; batch_id: number } | null;
  latest_batch: { id: number; month: number; year: number; title: string | null; link: string; link_sent_at: string | null; kanban_status: KanbanStatus; total: number; pending: number } | null;
}

export interface Asset { id: number; url: string; thumb_url: string | null; mime: string; width: number | null; height: number | null; sort_order?: number }

export interface Decision { action: 'approved' | 'rejected'; reason_category: RejectReason | null; comment: string | null; source: 'client' | 'auto'; decided_at: string }

export interface Creative {
  id: number; batch_id: number; type: CreativeType; caption: string; scheduled_date: string | null;
  status: CreativeStatus; current_version: number; sort_order: number; created_at: string;
  version_created_at: string; version_note: string | null; versions_count: number;
  decision: Decision | null; assets: Asset[];
}

export interface BatchSummary {
  id: number; client_id: number; month: number; year: number; title: string | null; kanban_status: KanbanStatus; status_changed_at: string;
  link_token: string | null; link_sent_at: string | null; viewed_at: string | null; submitted_at: string | null;
  feedback_rating: number | null; feedback_comment: string | null; feedback_at: string | null; feedback_read_at: string | null;
  client_name: string; client_logo_url: string | null; instagram_handle: string | null; whatsapp: string | null;
  designer_name: string | null; manager_name: string | null;
  total: number; approved: number; rejected: number; pending: number; stuck: boolean; link: string | null;
}

export interface EventRow { id: number; kind: string; payload: any; created_at: string; actor_name: string | null; creative_id: number | null }

export interface BatchDetail extends BatchSummary {
  creatives: Creative[]; events: EventRow[]; link: string | null; message: string | null; wa_url: string | null;
}

export interface Notification {
  id: number; created_at: string; read_at: string | null; creative_id: number; batch_id: number; client_name: string;
  month: number; year: number; creative_type: CreativeType; sort_order: number; creative_status: CreativeStatus;
  thumb_url: string | null; payload: { version: number; reason_category: RejectReason | null; comment: string | null };
}

export interface FeedbackRow {
  batch_id: number; client_id: number; month: number; year: number; title: string | null;
  rating: number; comment: string | null; at: string; read_at: string | null;
  client_name: string; client_logo_url: string | null; instagram_handle: string | null;
  designer_name: string | null; manager_name: string | null; total: number;
}
export interface FeedbackList {
  summary: { total: number; avg: number | null; unread: number; low: number; dist: Record<'1' | '2' | '3' | '4' | '5', number> };
  items: FeedbackRow[];
}

export interface PublicCreative {
  id: number; type: CreativeType; caption: string; scheduled_date: string | null; status: CreativeStatus; version: number;
  decision: Decision | null; assets: Asset[];
}
export interface PublicBatch {
  client: { name: string; logo_url: string | null; instagram_handle: string | null };
  batch: { id: number; month: number; year: number; title: string | null; submitted_at: string | null; feedback: { rating: number; comment: string | null; at: string } | null };
  creatives: PublicCreative[];
}

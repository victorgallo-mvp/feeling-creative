import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { BatchDetail, Creative, CreativeType } from '../../api/types';
import { Avatar, Badge, Button, Empty, Field, Input, Modal, Select, Spinner, Stars, Textarea } from '../../components/ui';
import { EVENT_LABEL, KANBAN_LABEL, REASON_LABEL, STATUS_LABEL, TYPE_LABEL, fmtDate, monthLabel } from '../../lib/format';
import { toast, toastError } from '../../components/toastStore';
import { LinkActions, copyText } from '../../components/LinkActions';
import { ArrowButton } from '../../components/CarouselArrows';

const ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4';

export function BatchPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['batch', id], queryFn: () => api.get<BatchDetail>(`/api/batches/${id}`) });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['batch', id] });
    qc.invalidateQueries({ queryKey: ['batches'] });
    qc.invalidateQueries({ queryKey: ['notif-count'] });
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };
  const [linkOpen, setLinkOpen] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const carouselRef = useRef<HTMLInputElement>(null);
  const storyRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(async (files: File[], mode: 'each' | 'single', type?: 'story') => {
    if (!files.length) return;
    setUploading((n) => n + files.length);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      fd.append('mode', mode);
      if (type) fd.append('type', type);
      const created = await api.post<Creative[]>(`/api/batches/${id}/creatives`, fd);
      const autoStories = !type && created.filter((c) => c.type === 'story').length;
      toast(mode === 'single' ? 'Carrossel criado'
        : type === 'story' ? `${files.length} stor${files.length > 1 ? 'ies' : 'y'} enviado${files.length > 1 ? 's' : ''}`
        : `${files.length} arte${files.length > 1 ? 's' : ''} enviada${files.length > 1 ? 's' : ''}${autoStories ? ` (${autoStories} em 9:16 marcada${autoStories > 1 ? 's' : ''} como story)` : ''}`);
      refresh();
    } catch (e) { toastError(e); } finally { setUploading((n) => n - files.length); }
  }, [id]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault(); setDragOver(false);
    upload(Array.from(e.dataTransfer.files), 'each');
  };

  useEffect(() => {
    if (location.hash && q.data) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [q.data]);

  if (q.isLoading) return <Spinner />;
  if (!q.data) return <Empty>Lote não encontrado</Empty>;
  const b = q.data;
  const pct = b.total ? Math.round((b.approved / b.total) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/app" className="text-sm text-neutral-500 hover:text-neutral-900">← Kanban</Link>
        <Avatar src={b.client_logo_url} name={b.client_name} size={40} />
        <div>
          <h1 className="display text-3xl text-black">{b.client_name} <span className="text-neutral-400">·</span> {monthLabel(b.month, b.year)}</h1>
          <BatchTitle batch={b} onChange={refresh} />
          <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
            <Badge tone={b.kanban_status === 'aprovado' ? 'green' : b.kanban_status === 'enviado_aprovacao' ? 'amber' : 'neutral'}>{KANBAN_LABEL[b.kanban_status]}</Badge>
            <span>{b.approved}/{b.total} aprovadas ({pct}%)</span>
            {b.rejected > 0 && <Badge tone="red">{b.rejected} recusada{b.rejected > 1 && 's'}</Badge>}
            {b.link_sent_at && <span>· link enviado {fmtDate(b.link_sent_at, true)}</span>}
            {b.viewed_at && <span>· aberto {fmtDate(b.viewed_at, true)}</span>}
            {b.submitted_at && <span>· enviado pelo cliente {fmtDate(b.submitted_at, true)}</span>}
          </div>
        </div>
        <div className="flex-1" />
        <Button variant="secondary" onClick={() => storyRef.current?.click()}>+ Stories</Button>
        <Button variant="secondary" onClick={() => carouselRef.current?.click()}>+ Carrossel</Button>
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>+ Artes</Button>
        <Button onClick={() => setLinkOpen(true)} disabled={b.total === 0}>{b.link_token ? 'Link + mensagem' : 'Gerar link + mensagem'}</Button>
        <input ref={fileRef} type="file" multiple accept={ACCEPT} hidden onChange={(e) => { upload(Array.from(e.target.files ?? []), 'each'); e.target.value = ''; }} />
        <input ref={carouselRef} type="file" multiple accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { upload(Array.from(e.target.files ?? []), 'single'); e.target.value = ''; }} />
        <input ref={storyRef} type="file" multiple accept={ACCEPT} hidden onChange={(e) => { upload(Array.from(e.target.files ?? []), 'each', 'story'); e.target.value = ''; }} />
      </div>

      {b.feedback_rating && (
        <section className="flex flex-wrap items-center gap-3 rounded-xl bg-black px-4 py-3 text-white ring-1 ring-brand-500/50">
          <span className="display text-lg text-brand-400">Feedback do cliente</span>
          <Stars value={b.feedback_rating} size={18} />
          <span className="text-sm text-neutral-200">“{b.feedback_comment}”</span>
          <span className="text-xs text-neutral-500">{fmtDate(b.feedback_at, true)}</span>
        </section>
      )}

      <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}
        className={`rounded-xl border-2 border-dashed p-5 text-center text-sm transition ${dragOver ? 'border-brand-500 bg-brand-50' : 'border-neutral-300 bg-white text-neutral-500'}`}>
        {uploading > 0 ? <span className="inline-flex items-center gap-2"><Spinner className="h-4 w-4" /> Enviando {uploading} arquivo{uploading > 1 && 's'}…</span>
          : <>Arraste imagens (JPG, PNG, WebP) ou vídeos (MP4) aqui. Cada arquivo vira uma arte; imagem em 9:16 já entra como story. Para carrossel, use “+ Carrossel”; para stories em vídeo, “+ Stories”.</>}
      </div>

      {b.creatives.length === 0 ? <Empty>Nenhuma arte ainda. Arraste os arquivos acima.</Empty> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {b.creatives.map((c, i) => <CreativeCard key={c.id} c={c} index={i + 1} onChange={refresh} />)}
        </div>
      )}

      <section className="rounded-xl bg-white p-4 ring-1 ring-neutral-200">
        <h2 className="display mb-2 text-xl">Atividade do lote</h2>
        <ul className="space-y-1 text-sm">
          {b.events.slice(0, 30).map((e) => (
            <li key={e.id} className="flex gap-3 text-neutral-700">
              <span className="w-28 shrink-0 text-xs text-neutral-400">{fmtDate(e.created_at, true)}</span>
              <span>{EVENT_LABEL[e.kind] ?? e.kind}{e.creative_id && <span className="text-neutral-400"> · arte #{b.creatives.findIndex((c) => c.id === e.creative_id) + 1 || e.creative_id}</span>}{e.actor_name && <span className="text-neutral-400"> · {e.actor_name}</span>}{e.payload?.reason_category && <span className="text-red-700"> · {REASON_LABEL[e.payload.reason_category as keyof typeof REASON_LABEL]}</span>}{e.kind === 'batch_submitted' && e.payload?.rating && <span className="text-neutral-500"> · nota {e.payload.rating}/5{e.payload.comment && <> — “{e.payload.comment}”</>}</span>}{e.kind === 'creative_decision_changed' && <span className="text-neutral-500"> · de {e.payload.from === 'rejected' ? 'recusada' : 'aprovada'} para {e.payload.to === 'rejected' ? 'recusada' : 'aprovada'}</span>}</span>
            </li>
          ))}
        </ul>
      </section>

      <LinkModal open={linkOpen} onClose={() => setLinkOpen(false)} batch={b} onChange={refresh} />
    </div>
  );
}

function CreativeCard({ c, index, onChange }: { c: Creative; index: number; onChange: () => void }) {
  const [f, setF] = useState({ caption: c.caption, type: c.type, scheduled_date: c.scheduled_date ?? '' });
  useEffect(() => setF({ caption: c.caption, type: c.type, scheduled_date: c.scheduled_date ?? '' }), [c.caption, c.type, c.scheduled_date]);
  const [history, setHistory] = useState(false);
  const [newVersion, setNewVersion] = useState(false);
  const [slide, setSlide] = useState(0);
  const dirty = f.caption !== c.caption || f.type !== c.type || f.scheduled_date !== (c.scheduled_date ?? '');

  const save = useMutation({
    mutationFn: () => api.put<Creative & { reopened?: boolean }>(`/api/creatives/${c.id}`, f),
    onSuccess: (r) => { if (r.reopened) toast('Legenda/tipo mudaram: a arte voltou a pendente para o cliente aprovar de novo'); onChange(); },
    onError: toastError,
  });
  const del = useMutation({ mutationFn: () => api.del(`/api/creatives/${c.id}`), onSuccess: () => { toast('Arte excluída'); onChange(); }, onError: toastError });
  const reorder = useMutation({
    mutationFn: (ids: number[]) => api.put(`/api/creatives/${c.id}/assets/order`, { asset_ids: ids }),
    onSuccess: onChange, onError: toastError,
  });
  const moveAsset = (dir: -1 | 1) => {
    const ids = c.assets.map((a) => a.id);
    const j = slide + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[slide], ids[j]] = [ids[j], ids[slide]];
    setSlide(j);
    reorder.mutate(ids);
  };

  const tone = c.status === 'approved' || c.status === 'auto_approved' ? 'green' : c.status === 'rejected' ? 'red' : 'amber';
  const asset = c.assets[slide] ?? c.assets[0];
  const expected = c.type === 'story' ? 9 / 16 : 4 / 5;
  const offRatio = c.assets.filter((a) => a.width && a.height && Math.abs(a.width / a.height - expected) > 0.02);

  return (
    <div id={`arte-${c.id}`} className={`flex flex-col overflow-hidden rounded-xl bg-white ring-1 ${c.status === 'rejected' ? 'ring-red-300' : 'ring-neutral-200'}`}>
      <div className={`relative ${c.type === 'story' ? 'aspect-[9/16]' : 'aspect-[4/5]'} bg-neutral-100`}>
        {asset?.mime.startsWith('video') ? <video src={asset.url} controls preload="metadata" className="h-full w-full object-contain" />
          : asset ? <img src={asset.thumb_url ?? asset.url} className="h-full w-full object-cover" /> : null}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1"><Badge>#{index}</Badge><Badge tone={tone}>{STATUS_LABEL[c.status]}</Badge>{c.current_version > 1 && <Badge tone="blue">v{c.current_version}</Badge>}{offRatio.length > 0 && <Badge tone="amber" >⚠ não é {c.type === 'story' ? '9:16' : '4:5'}</Badge>}</div>
        {c.assets.length > 1 && (
          <>
            <ArrowButton dir="prev" size="sm" onClick={() => setSlide((s) => Math.max(0, s - 1))} disabled={slide === 0} className="absolute left-2 top-1/2 -translate-y-1/2" />
            <ArrowButton dir="next" size="sm" onClick={() => setSlide((s) => Math.min(c.assets.length - 1, s + 1))} disabled={slide === c.assets.length - 1} className="absolute right-2 top-1/2 -translate-y-1/2" />
            <div className="absolute inset-x-0 bottom-2 flex items-center justify-center gap-1.5">
              <span className="rounded-full bg-black/75 px-2.5 py-0.5 text-xs font-semibold text-white ring-1 ring-white/30">{slide + 1}/{c.assets.length}</span>
              <button onClick={() => moveAsset(-1)} title="Mover esta lâmina para antes" className="rounded-full bg-black/75 px-2 py-0.5 text-xs text-white ring-1 ring-white/30 hover:bg-black">⇠ ordem</button>
              <button onClick={() => moveAsset(1)} title="Mover esta lâmina para depois" className="rounded-full bg-black/75 px-2 py-0.5 text-xs text-white ring-1 ring-white/30 hover:bg-black">ordem ⇢</button>
            </div>
          </>
        )}
      </div>
      <div className="space-y-2 p-3">
        {c.decision?.action === 'rejected' && (
          <div className="rounded-md bg-red-50 p-2 text-xs text-red-800">
            <b>Recusada:</b> {c.decision.reason_category ? REASON_LABEL[c.decision.reason_category] : '—'}{c.decision.comment && <> — “{c.decision.comment}”</>}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as CreativeType })}>{(Object.keys(TYPE_LABEL) as CreativeType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</Select>
          <Input type="date" value={f.scheduled_date} onChange={(e) => setF({ ...f, scheduled_date: e.target.value })} />
        </div>
        <Textarea value={f.caption} onChange={(e) => setF({ ...f, caption: e.target.value })} placeholder="Legenda do post…" className="min-h-20 text-xs" />
        <div className="flex flex-wrap items-center gap-1">
          {dirty && <Button className="px-3 py-1 text-xs" onClick={() => save.mutate()} loading={save.isPending}>Salvar</Button>}
          <Button variant={c.status === 'rejected' ? 'primary' : 'secondary'} className="px-3 py-1 text-xs" onClick={() => setNewVersion(true)}>Subir nova versão</Button>
          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setHistory(true)}>Histórico{c.versions_count > 1 && ` (${c.versions_count}v)`}</Button>
          <Button variant="ghost" className="px-2 py-1 text-xs text-red-600" onClick={() => confirm('Excluir esta arte e todo o histórico?') && del.mutate()}>Excluir</Button>
        </div>
      </div>
      <HistoryModal open={history} onClose={() => setHistory(false)} creativeId={c.id} />
      <NewVersionModal open={newVersion} onClose={() => setNewVersion(false)} c={c} onChange={onChange} />
    </div>
  );
}

function NewVersionModal({ open, onClose, c, onChange }: { open: boolean; onClose: () => void; c: Creative; onChange: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState('');
  const [caption, setCaption] = useState(c.caption);
  useEffect(() => { if (open) { setFiles([]); setNote(''); setCaption(c.caption); } }, [open]);
  const send = useMutation({
    mutationFn: () => { const fd = new FormData(); files.forEach((f) => fd.append('files', f)); fd.append('note', note); fd.append('caption', caption); return api.post(`/api/creatives/${c.id}/versions`, fd); },
    onSuccess: () => { toast(`Versão v${c.current_version + 1} enviada. Voltou a pendente no link do cliente.`); onChange(); onClose(); },
    onError: toastError,
  });
  return (
    <Modal open={open} onClose={onClose} title={`Nova versão (v${c.current_version + 1})`}>
      <div className="space-y-3">
        {c.decision?.action === 'rejected' && <div className="rounded-md bg-red-50 p-2 text-sm text-red-800">Cliente recusou por <b>{c.decision.reason_category ? REASON_LABEL[c.decision.reason_category] : '—'}</b>{c.decision.comment && <>: “{c.decision.comment}”</>}</div>}
        <Field label={c.type === 'carrossel' ? 'Imagens do carrossel (todas, na ordem)' : 'Arquivo'}><Input type="file" multiple={c.type === 'carrossel'} accept={c.type === 'video' ? 'video/mp4' : c.type === 'story' ? ACCEPT : 'image/jpeg,image/png,image/webp'} onChange={(e) => setFiles(Array.from(e.target.files ?? []))} /></Field>
        <Field label="Legenda"><Textarea value={caption} onChange={(e) => setCaption(e.target.value)} /></Field>
        <Field label="O que mudou (opcional, só interno)"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex.: clareei a foto e troquei o título" /></Field>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button onClick={() => send.mutate()} disabled={!files.length} loading={send.isPending}>Enviar versão</Button></div>
      </div>
    </Modal>
  );
}

function HistoryModal({ open, onClose, creativeId }: { open: boolean; onClose: () => void; creativeId: number }) {
  const q = useQuery({ queryKey: ['timeline', creativeId], queryFn: () => api.get<any>(`/api/creatives/${creativeId}/timeline`), enabled: open });
  return (
    <Modal open={open} onClose={onClose} title="Histórico da arte" wide>
      {q.isLoading ? <Spinner /> : q.data && (
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold">Linha do tempo</h3>
            <ol className="relative space-y-3 border-l border-neutral-200 pl-4 text-sm">
              {q.data.events.map((e: any) => (
                <li key={e.id}>
                  <span className="absolute -left-1 mt-1.5 h-2 w-2 rounded-full bg-neutral-400" />
                  <div className="font-medium">{EVENT_LABEL[e.kind] ?? e.kind}{e.payload?.version && <span className="text-neutral-400"> · v{e.payload.version}</span>}</div>
                  <div className="text-xs text-neutral-500">{fmtDate(e.created_at, true)}{e.actor_name && ` · ${e.actor_name}`}</div>
                  {e.payload?.reason_category && <div className="text-xs text-red-700">{REASON_LABEL[e.payload.reason_category as keyof typeof REASON_LABEL]}{e.payload.comment && ` — “${e.payload.comment}”`}</div>}
                  {e.payload?.note && <div className="text-xs text-neutral-600">“{e.payload.note}”</div>}
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Versões</h3>
            <div className="space-y-3">
              {[...q.data.versions].reverse().map((v: any) => (
                <div key={v.id} className="rounded-lg bg-neutral-50 p-2 text-xs">
                  <div className="mb-1 flex items-center gap-2"><Badge tone="blue">v{v.version}</Badge><span className="text-neutral-500">{fmtDate(v.created_at, true)} · {v.created_by_name ?? '—'}</span>{v.decision && <Badge tone={v.decision.action === 'approved' ? 'green' : 'red'}>{v.decision.action === 'approved' ? (v.decision.source === 'auto' ? 'auto-aprovada' : 'aprovada') : 'recusada'}</Badge>}</div>
                  {v.note && <div className="mb-1 text-neutral-600">“{v.note}”</div>}
                  <div className="flex gap-1 overflow-x-auto">{v.assets.map((a: any) => a.mime.startsWith('video') ? <video key={a.id} src={a.url} className="h-24 rounded" /> : <img key={a.id} src={a.thumb_url ?? a.url} className="h-24 rounded object-cover" />)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function LinkModal({ open, onClose, batch, onChange }: { open: boolean; onClose: () => void; batch: BatchDetail; onChange: () => void }) {
  const [data, setData] = useState<{ link: string; message: string; wa_url: string } | null>(batch.link ? { link: batch.link, message: batch.message!, wa_url: batch.wa_url! } : null);
  useEffect(() => { if (batch.link) setData({ link: batch.link, message: batch.message!, wa_url: batch.wa_url! }); }, [batch.link, batch.message, batch.wa_url]);
  const gen = useMutation({
    mutationFn: (rotate: boolean) => api.post<{ link: string; message: string; wa_url: string }>(`/api/batches/${batch.id}/link`, { rotate }),
    onSuccess: (d, rotate) => { setData(d); onChange(); toast(rotate ? 'Novo link gerado; o anterior parou de funcionar' : 'Link gerado'); },
    onError: toastError,
  });
  const requested = useRef(false);
  useEffect(() => {
    if (open && !batch.link_token && !data && !requested.current) { requested.current = true; gen.mutate(false); }
    if (!open) requested.current = false;
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Link de aprovação + mensagem">
      {!data ? <Spinner /> : (
        <div className="space-y-3">
          <Field label="Link do cliente (sem login)">
            <div className="flex flex-wrap items-center gap-2"><Input readOnly value={data.link} onFocus={(e) => e.target.select()} className="min-w-0 flex-1" /><LinkActions link={data.link} /></div>
          </Field>
          <Field label="Mensagem"><Textarea readOnly value={data.message} className="min-h-28" /></Field>
          <div className="flex flex-wrap gap-2">
            <a href={data.wa_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-black hover:bg-brand-400">Abrir WhatsApp</a>
            <Button variant="secondary" onClick={() => copyText(data.message, 'Mensagem')}>Copiar mensagem</Button>
            <Button variant="ghost" onClick={() => confirm('Gerar um novo link? O link antigo deixa de funcionar.') && gen.mutate(true)} loading={gen.isPending}>Gerar novo link</Button>
          </div>
          {!batch.whatsapp && <p className="text-xs text-amber-700">Cliente sem WhatsApp cadastrado: o botão abre o WhatsApp sem destinatário.</p>}
          <p className="text-xs text-neutral-500">Ao gerar o link o lote vai para “Enviado para aprovação”. Reenviar a mesma mensagem não troca o link.</p>
        </div>
      )}
    </Modal>
  );
}

/** Nome do lote (opcional), editável inline. Útil quando há mais de um lote no mês. */
function BatchTitle({ batch, onChange }: { batch: BatchDetail; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(batch.title ?? '');
  useEffect(() => setValue(batch.title ?? ''), [batch.title]);
  const save = useMutation({
    mutationFn: () => api.patch(`/api/batches/${batch.id}`, { title: value.trim() || null }),
    onSuccess: () => { setEditing(false); onChange(); },
    onError: toastError,
  });
  if (editing) {
    return (
      <div className="mt-1 flex items-center gap-2">
        <Input autoFocus value={value} maxLength={80} placeholder="Nome do lote (opcional)" className="h-8 w-64 text-sm" onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save.mutate(); if (e.key === 'Escape') setEditing(false); }} />
        <Button className="px-3 py-1 text-xs" onClick={() => save.mutate()} loading={save.isPending}>Salvar</Button>
        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setEditing(false)}>Cancelar</Button>
      </div>
    );
  }
  return (
    <button onClick={() => setEditing(true)} className="mt-0.5 text-sm text-neutral-500 hover:text-neutral-900" title="Renomear lote">
      {batch.title ? batch.title : <span className="italic">sem nome</span>} <span className="text-xs">✎</span>
    </button>
  );
}

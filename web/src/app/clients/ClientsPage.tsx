import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LinkActions } from '../../components/LinkActions';
import { monthLabel } from '../../lib/format';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { Client, User } from '../../api/types';
import { Avatar, Badge, Button, Empty, Field, Input, Modal, PageTitle, Select, Spinner, Stars } from '../../components/ui';
import { toast, toastError } from '../../components/toastStore';

export function ClientsPage() {
  const qc = useQueryClient();
  const clients = useQuery({ queryKey: ['clients'], queryFn: () => api.get<Client[]>('/api/clients') });
  const [editing, setEditing] = useState<Client | 'new' | null>(null);
  const del = useMutation({
    mutationFn: (id: number) => api.del(`/api/clients/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast('Cliente removido'); },
    onError: toastError,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <PageTitle>Clientes</PageTitle>
        <div className="flex-1" />
        <Button onClick={() => setEditing('new')}>+ Novo cliente</Button>
      </div>
      {clients.isLoading ? <Spinner /> : !clients.data?.length ? <Empty>Nenhum cliente ainda. Crie o primeiro.</Empty> : (
        <div className="overflow-hidden rounded-xl bg-white ring-1 ring-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr><th className="px-4 py-2">Cliente</th><th className="px-4 py-2">Link de aprovação</th><th className="px-4 py-2">WhatsApp</th><th className="px-4 py-2">Designer / Gestor</th><th className="px-4 py-2">Avaliação</th><th className="px-4 py-2">Auto-aprovação</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {clients.data.map((c) => (
                <tr key={c.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-2"><Link to={`/app/clientes/${c.id}`} className="flex items-center gap-2 hover:underline"><Avatar src={c.logo_url} name={c.name} size={28} /><div><div className="font-medium">{c.name}</div>{c.instagram_handle && <div className="text-xs text-neutral-500">@{c.instagram_handle}</div>}</div></Link></td>
                  <td className="px-4 py-2">
                    {c.latest_batch ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-neutral-500">{c.latest_batch.title ? `${c.latest_batch.title} · ` : ''}{monthLabel(c.latest_batch.month, c.latest_batch.year)}{c.latest_batch.pending > 0 ? ` · ${c.latest_batch.pending} pendente${c.latest_batch.pending > 1 ? 's' : ''}` : ' · tudo respondido'}</span>
                        <LinkActions link={c.latest_batch.link} size="sm" />
                      </div>
                    ) : <span className="text-xs text-neutral-400">nenhum link gerado</span>}
                  </td>
                  <td className="px-4 py-2 text-neutral-600">{c.whatsapp ?? '—'}</td>
                  <td className="px-4 py-2 text-neutral-600">{c.designer_name ?? '—'} / {c.manager_name ?? '—'}</td>
                  <td className="px-4 py-2">{c.feedback_avg != null ? <Link to="/app/feedbacks" className="flex items-center gap-1.5" title={c.last_feedback?.comment ?? ''}><span className={`font-semibold ${c.feedback_avg <= 2.5 ? 'text-red-600' : ''}`}>{c.feedback_avg.toFixed(1)}</span><Stars value={Math.round(c.feedback_avg)} size={13} /><span className="text-xs text-neutral-400">({c.feedback_count})</span></Link> : <span className="text-xs text-neutral-400">sem avaliação</span>}</td>
                  <td className="px-4 py-2">{c.auto_approve_enabled ? <Badge tone="amber">Ligada · {c.auto_approve_days}d</Badge> : <Badge>Desligada</Badge>}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <Button variant="ghost" onClick={() => setEditing(c)}>Editar</Button>
                    <Button variant="ghost" className="text-red-600" onClick={() => confirm(`Remover ${c.name}?`) && del.mutate(c.id)}>Remover</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ClientModal client={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

const empty = { name: '', instagram_handle: '', whatsapp: '', designer_id: '' as number | '', manager_id: '' as number | '', auto_approve_enabled: false, auto_approve_days: 7 };

function ClientModal({ client, onClose }: { client: Client | 'new' | null; onClose: () => void }) {
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ['users'], queryFn: () => api.get<User[]>('/api/users'), enabled: !!client });
  const [f, setF] = useState(empty);
  const [logo, setLogo] = useState<File | null>(null);
  useEffect(() => {
    if (client && client !== 'new') setF({ name: client.name, instagram_handle: client.instagram_handle ?? '', whatsapp: client.whatsapp ?? '', designer_id: client.designer_id ?? '', manager_id: client.manager_id ?? '', auto_approve_enabled: client.auto_approve_enabled, auto_approve_days: client.auto_approve_days });
    else setF(empty);
    setLogo(null);
  }, [client]);

  const save = useMutation({
    mutationFn: async () => {
      const body = { ...f, designer_id: f.designer_id || null, manager_id: f.manager_id || null };
      const saved = client === 'new' ? await api.post<Client>('/api/clients', body) : await api.put<Client>(`/api/clients/${(client as Client).id}`, body);
      if (logo) {
        const fd = new FormData(); fd.append('logo', logo);
        try { await api.post(`/api/clients/${saved.id}/logo`, fd); }
        catch (e) { return { logoError: e instanceof Error ? e.message : 'Falha ao enviar a logo' }; }
      }
      return { logoError: null };
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      if (r.logoError) toast(`Cliente salvo, mas a logo não foi aceita: ${r.logoError}`, 'error'); else toast('Cliente salvo');
      onClose();
    },
    onError: toastError,
  });
  const set = (k: keyof typeof f, v: any) => setF((s) => ({ ...s, [k]: v }));

  return (
    <Modal open={!!client} onClose={onClose} title={client === 'new' ? 'Novo cliente' : 'Editar cliente'}>
      <div className="space-y-3">
        <Field label="Nome"><Input value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="@ do Instagram"><Input value={f.instagram_handle} onChange={(e) => set('instagram_handle', e.target.value)} placeholder="sportfitness" /></Field>
          <Field label="WhatsApp" hint="DDD + número; o +55 é adicionado"><Input value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="31 99999-9999" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Designer"><Select value={f.designer_id} onChange={(e) => set('designer_id', e.target.value ? Number(e.target.value) : '')}><option value="">—</option>{users.data?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
          <Field label="Gestor"><Select value={f.manager_id} onChange={(e) => set('manager_id', e.target.value ? Number(e.target.value) : '')}><option value="">—</option>{users.data?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
        </div>
        <Field label="Logo" hint="JPG, PNG ou WebP"><Input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} /></Field>
        <div className="rounded-lg bg-neutral-50 p-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.auto_approve_enabled} onChange={(e) => set('auto_approve_enabled', e.target.checked)} /> Auto-aprovação por prazo</label>
          <div className="mt-2 flex items-center gap-2 text-sm text-neutral-600">Aprovar automaticamente após <Input type="number" min={1} max={60} className="w-20" value={f.auto_approve_days} onChange={(e) => set('auto_approve_days', Number(e.target.value))} /> dias sem resposta</div>
          <p className="mt-1 text-xs text-neutral-500">Desligada por padrão. O job diário só age nos clientes com a opção marcada.</p>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={!f.name.trim()} loading={save.isPending}>Salvar</Button>
        </div>
      </div>
    </Modal>
  );
}

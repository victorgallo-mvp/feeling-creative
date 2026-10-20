import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { User } from '../../api/types';
import { useAuth } from '../AuthContext';
import { Button, Field, Input, Select, Spinner, Textarea } from '../../components/ui';
import { toast, toastError } from '../../components/toastStore';

export function SettingsPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'gestor';
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api.get<Record<string, string>>('/api/settings') });
  const [template, setTemplate] = useState('');
  useEffect(() => { if (settings.data) setTemplate(settings.data.whatsapp_template); }, [settings.data]);
  const save = useMutation({
    mutationFn: () => api.put('/api/settings', { whatsapp_template: template }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); toast('Template salvo'); },
    onError: toastError,
  });

  const users = useQuery({ queryKey: ['users'], queryFn: () => api.get<User[]>('/api/users') });
  const [nu, setNu] = useState({ name: '', email: '', password: '', role: 'designer' as 'designer' | 'gestor' });
  const createUser = useMutation({
    mutationFn: () => api.post('/api/users', nu),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setNu({ name: '', email: '', password: '', role: 'designer' }); toast('Usuário criado'); },
    onError: toastError,
  });

  const preview = template.replaceAll('{cliente}', 'Sport Fitness').replaceAll('{qtd_artes}', '8').replaceAll('{link}', 'https://…/a/abc123').replaceAll('{lote}', 'outubro de 2026');

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3 rounded-xl bg-white p-5 ring-1 ring-neutral-200">
        <h2 className="font-semibold">Mensagem padrão do WhatsApp</h2>
        <p className="text-sm text-neutral-500">Use os marcadores <code>{'{cliente}'}</code>, <code>{'{link}'}</code>, <code>{'{qtd_artes}'}</code> e <code>{'{lote}'}</code> (nome do lote + mês).</p>
        {settings.isLoading ? <Spinner /> : <Textarea value={template} onChange={(e) => setTemplate(e.target.value)} disabled={!isManager} className="min-h-32" />}
        <div className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700 whitespace-pre-wrap">{preview}</div>
        {isManager ? <Button onClick={() => save.mutate()} loading={save.isPending}>Salvar</Button> : <p className="text-xs text-neutral-500">Só gestores editam o template.</p>}
      </section>

      <section className="space-y-3 rounded-xl bg-white p-5 ring-1 ring-neutral-200">
        <h2 className="font-semibold">Equipe</h2>
        <ul className="divide-y divide-neutral-100 text-sm">
          {users.data?.map((u) => <li key={u.id} className="flex justify-between py-1.5"><span>{u.name} <span className="text-neutral-400">· {u.email}</span></span><span className="text-neutral-500">{u.role}</span></li>)}
        </ul>
        {isManager && (
          <div className="space-y-2 border-t border-neutral-100 pt-3">
            <div className="text-sm font-medium">Novo usuário</div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Nome" value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} />
              <Input placeholder="E-mail" type="email" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} />
              <Input placeholder="Senha (mín. 6)" type="password" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} />
              <Select value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value as any })}><option value="designer">Designer</option><option value="gestor">Gestor</option></Select>
            </div>
            <Field label=""><Button onClick={() => createUser.mutate()} loading={createUser.isPending} disabled={!nu.name || !nu.email || nu.password.length < 6}>Criar usuário</Button></Field>
          </div>
        )}
      </section>
    </div>
  );
}

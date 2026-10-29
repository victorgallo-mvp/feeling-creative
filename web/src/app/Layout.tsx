import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { api } from '../api/client';
import { Logo, Spinner } from '../components/ui';

const links = [
  { to: '/app', label: 'Kanban', end: true },
  { to: '/app/clientes', label: 'Clientes' },
  { to: '/app/notificacoes', label: 'Recusas' },
  { to: '/app/feedbacks', label: 'Feedbacks' },
  { to: '/app/configuracoes', label: 'Configurações' },
  { to: '/app/historico', label: 'Histórico' },
];

export function Layout() {
  const { user, loading, logout } = useAuth();
  const count = useQuery({ queryKey: ['notif-count'], queryFn: () => api.get<{ n: number }>('/api/notifications/count'), refetchInterval: 30_000, enabled: !!user });
  const fb = useQuery({ queryKey: ['feedback-count'], queryFn: () => api.get<{ n: number; low: number }>('/api/feedbacks/count'), refetchInterval: 30_000, enabled: !!user });
  if (loading) return <div className="flex h-full items-center justify-center"><Spinner /></div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-brand-500/40 bg-black text-white">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-2.5">
          <NavLink to="/app" className="flex shrink-0 items-center" title="Feeling · Aprovação de criativos">
            <Logo on="dark" className="hidden h-9 sm:block" />
            <Logo variant="symbol" className="h-8 sm:hidden" />
          </NavLink>
          <nav className="flex flex-1 gap-1 overflow-x-auto no-scrollbar">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end}
                className={({ isActive }) => `relative whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${isActive ? 'bg-brand-500 text-black' : 'text-neutral-300 hover:bg-white/10 hover:text-white'}`}>
                {l.label}
                {l.label === 'Recusas' && (count.data?.n ?? 0) > 0 && (
                  <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white">{count.data!.n}</span>
                )}
                {l.label === 'Feedbacks' && (fb.data?.n ?? 0) > 0 && (
                  <span className={`ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${(fb.data?.low ?? 0) > 0 ? 'bg-red-600 text-white' : 'bg-brand-500 text-black'}`}>{fb.data!.n}</span>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-3 text-sm sm:flex">
            <span className="text-neutral-300">{user.name} <span className="text-neutral-500">· {user.role}</span></span>
            <button onClick={logout} className="text-neutral-400 hover:text-brand-400">Sair</button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { api } from '../api/client';
import { Spinner } from '../components/ui';

const links = [
  { to: '/app', label: 'Kanban', end: true },
  { to: '/app/clientes', label: 'Clientes' },
  { to: '/app/notificacoes', label: 'Recusas' },
  { to: '/app/configuracoes', label: 'Configurações' },
];

export function Layout() {
  const { user, loading, logout } = useAuth();
  const count = useQuery({ queryKey: ['notif-count'], queryFn: () => api.get<{ n: number }>('/api/notifications/count'), refetchInterval: 30_000, enabled: !!user });
  if (loading) return <div className="flex h-full items-center justify-center"><Spinner /></div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
          <div className="text-lg font-bold tracking-tight">Feeling</div>
          <nav className="flex flex-1 gap-1 overflow-x-auto no-scrollbar">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end}
                className={({ isActive }) => `relative whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}>
                {l.label}
                {l.label === 'Recusas' && (count.data?.n ?? 0) > 0 && (
                  <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white">{count.data!.n}</span>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-3 text-sm sm:flex">
            <span className="text-neutral-600">{user.name} <span className="text-neutral-400">· {user.role}</span></span>
            <button onClick={logout} className="text-neutral-500 hover:text-neutral-900">Sair</button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

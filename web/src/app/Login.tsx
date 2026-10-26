import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Button, Field, Input, Logo } from '../components/ui';

export function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  if (user) return <Navigate to="/app" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try { await login(email, password); nav('/app'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Erro ao entrar'); }
    finally { setLoading(false); }
  };

  return (
    <div className="glow-bg flex min-h-full flex-col items-center justify-center p-6 text-white">
      <Logo on="dark" className="mb-8 h-12" />
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 text-neutral-900 shadow-2xl">
        <div>
          <h1 className="display text-3xl">Painel interno</h1>
          <div className="mt-1 text-sm text-neutral-500">Aprovação de criativos</div>
        </div>
        <Field label="E-mail"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required /></Field>
        <Field label="Senha"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <Button type="submit" className="w-full py-2.5" loading={loading}>Entrar</Button>
      </form>
      <p className="mt-6 text-xs text-neutral-500">Feeling Marketing Digital · uso interno</p>
    </div>
  );
}

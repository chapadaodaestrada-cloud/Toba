import { FileText, Gift, History, LayoutDashboard, LogOut, User } from 'lucide-react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Logo } from '../components/common';
import { DemoBanner, Spinner } from '../components/feedback';
import { Button } from '../components/ui';
import { useSettings } from '../hooks/common';
import { useUserAuth } from '../hooks/useAuth';

const items = [
  { to: '/minha-conta/dashboard', label: 'Resumo', icon: LayoutDashboard },
  { to: '/minha-conta/perfil', label: 'Meu perfil', icon: User },
  { to: '/minha-conta/beneficios', label: 'Benefícios', icon: Gift },
  { to: '/minha-conta/solicitacoes', label: 'Solicitações', icon: FileText },
  { to: '/minha-conta/historico', label: 'Histórico', icon: History },
];

export default function UserLayout() {
  const { me, loading, logout } = useUserAuth();
  const { data: s } = useSettings();
  const loc = useLocation();
  const nav = useNavigate();
  if (loading) return <Spinner />;
  if (!me) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;

  return (
    <div className="min-h-screen bg-slate-50">
      {s?.demoMode && <DemoBanner />}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Logo name={s?.platformName} suffix="Área do usuário" />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-600 sm:inline">{me.name}</span>
            <Button variant="secondary" size="sm" onClick={async () => { await logout(); nav('/'); }}>
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4" aria-label="Minha conta">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) => clsx('flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium whitespace-nowrap',
                isActive ? 'border-navy-700 text-navy-800' : 'border-transparent text-slate-500 hover:text-navy-800')}>
              <Icon className="h-4 w-4" />{label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8"><Outlet /></main>
    </div>
  );
}

import {
  Activity, FileText, Gift, LayoutDashboard, LogOut, Menu, Newspaper, Settings, ShieldCheck, Users, X,
} from 'lucide-react';
import { Suspense, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { DemoBanner, Spinner } from '../components/feedback';
import { useSettings } from '../hooks/common';
import { can, useAdminAuth } from '../hooks/useAuth';

const nav = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/usuarios', label: 'UsuÃ¡rios', icon: Users, perm: 'users:read' },
  { to: '/admin/beneficios', label: 'BenefÃ­cios', icon: Gift, perm: 'benefits:read' },
  { to: '/admin/solicitacoes', label: 'SolicitaÃ§Ãµes', icon: FileText, perm: 'applications:read' },
  { to: '/admin/noticias', label: 'NotÃ­cias', icon: Newspaper, perm: 'news:read' },
  { to: '/admin/administradores', label: 'Administradores', icon: ShieldCheck, perm: 'admins:manage' },
  { to: '/admin/atividades', label: 'Atividades', icon: Activity, perm: 'activities:read' },
  { to: '/admin/configuracoes', label: 'ConfiguraÃ§Ãµes', icon: Settings, perm: 'settings:read' },
];

export default function AdminLayout() {
  const { me, loading, logout } = useAdminAuth();
  const { data: s } = useSettings();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const go = useNavigate();
  if (loading) return <Spinner />;
  if (!me) return <Navigate to="/admin/login" replace state={{ from: loc.pathname }} />;

  const roleLabel = { SUPER_ADMIN: 'Super administrador', ADMIN: 'Administrador', OPERADOR: 'Operador' }[me.role] ?? me.role;

  const sidebar = (
    <div className="flex h-full flex-col bg-navy-900 text-navy-100">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-white"><ShieldCheck className="h-5 w-5" /></span>
        <span className="leading-tight">
          <span className="block text-sm font-semibold text-white">{s?.platformName ?? 'MagistÃ©rio BenefÃ­cios'}</span>
          <span className="block text-[10px] tracking-widest text-navy-200 uppercase">Painel administrativo</span>
        </span>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="AdministraÃ§Ã£o">
        {nav.filter((n) => !n.perm || can(me, n.perm)).map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} onClick={() => setOpen(false)}
            className={({ isActive }) => clsx('flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium',
              isActive ? 'bg-navy-700 text-white' : 'text-navy-100 hover:bg-navy-800')}>
            <Icon className="h-4 w-4" />{label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-navy-800 p-4 text-xs">
        <NavLink to="/" className="text-navy-200 hover:text-white">â† Ver portal pÃºblico</NavLink>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64">{sidebar}</aside>
        </div>
      )}
      <div className="lg:pl-64">
        {s?.demoMode && <DemoBanner />}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
          <button className="rounded p-2 lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="hidden text-sm text-slate-500 lg:block">Ãrea administrativa restrita</div>
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="text-sm font-medium text-navy-900">{me.name}</div>
              <div className="text-xs text-slate-500">{roleLabel}</div>
            </div>
            <button
              onClick={async () => { await logout(); go('/admin/login'); }}
              className="flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </header>
        <main className="p-4 lg:p-8"><Suspense fallback={<Spinner />}><Outlet /></Suspense></main>
      </div>
    </div>
  );
}

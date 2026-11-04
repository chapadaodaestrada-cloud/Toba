import { Navigate, createBrowserRouter, Link, type RouteObject } from 'react-router-dom';
import { lazy, type ReactNode } from 'react';
import { Button } from '../components/ui';
import { Spinner } from '../components/feedback';
import { can, useAdminAuth } from '../hooks/useAuth';
import AdminLayout from '../layouts/AdminLayout';
import PublicLayout from '../layouts/PublicLayout';
import UserLayout from '../layouts/UserLayout';
import { AdminLoginPage, ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from '../pages/auth/AuthPages';
import { BenefitDetailPage, BenefitsPage } from '../pages/public/BenefitPages';
import HomePage from '../pages/public/HomePage';
import { AboutPage, NewsDetailPage, NewsListPage, ServicesPage } from '../pages/public/InfoPages';
import {
  ApplicationDetailPage, ApplicationsPage, HistoryPage, MyBenefitsPage, ProfilePage, UserDashboardPage,
} from '../pages/user/UserPages';

const AdminAdminsPage = lazy(() => import('../pages/admin/AdminAdminsPage'));
const AdminApplicationsPage = lazy(() => import('../pages/admin/AdminApplicationsPage'));
const AdminApplicationDetailPage = lazy(() => import('../pages/admin/AdminApplicationsPage').then((m) => ({ default: m.AdminApplicationDetailPage })));
const AdminBenefitsPage = lazy(() => import('../pages/admin/AdminBenefitsPage'));
const AdminDashboardPage = lazy(() => import('../pages/admin/AdminDashboardPage'));
const AdminNewsPage = lazy(() => import('../pages/admin/AdminNewsPage'));
const AdminActivitiesPage = lazy(() => import('../pages/admin/AdminSystemPages').then((m) => ({ default: m.AdminActivitiesPage })));
const AdminSettingsPage = lazy(() => import('../pages/admin/AdminSystemPages').then((m) => ({ default: m.AdminSettingsPage })));
const AdminUsersPage = lazy(() => import('../pages/admin/AdminUsersPage'));
/** Guard de UX: o backend revalida toda permissÃ£o; aqui evitamos telas que resultariam em 403. */
function Guard({ permission, children }: { permission: string; children: ReactNode }) {
  const { me } = useAdminAuth();
  if (!can(me, permission)) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-xl font-semibold text-navy-900">Acesso nÃ£o autorizado</h1>
        <p className="mt-2 text-sm text-slate-600">Seu perfil nÃ£o possui permissÃ£o para acessar esta Ã¡rea.</p>
        <Link to="/admin/dashboard"><Button className="mt-4">Voltar ao dashboard</Button></Link>
      </div>
    );
  }
  return <>{children}</>;
}

function AdminIndex() {
  const { me, loading } = useAdminAuth();
  if (loading) return <Spinner />;
  return <Navigate to={me ? '/admin/dashboard' : '/admin/login'} replace />;
}

const NotFound = () => (
  <div className="mx-auto max-w-md px-4 py-24 text-center">
    <h1 className="text-5xl font-semibold text-navy-800">404</h1>
    <p className="mt-3 text-slate-600">PÃ¡gina nÃ£o encontrada.</p>
    <Link to="/"><Button className="mt-6">Ir para o inÃ­cio</Button></Link>
  </div>
);

const routes: RouteObject[] = [
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/beneficios', element: <BenefitsPage /> },
      { path: '/beneficios/:slug', element: <BenefitDetailPage /> },
      { path: '/servicos', element: <ServicesPage /> },
      { path: '/institucional', element: <AboutPage /> },
      { path: '/noticias', element: <NewsListPage /> },
      { path: '/noticias/:slug', element: <NewsDetailPage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/cadastro', element: <RegisterPage /> },
      { path: '/recuperar-senha', element: <ForgotPasswordPage /> },
      { path: '/redefinir-senha', element: <ResetPasswordPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
  {
    path: '/minha-conta',
    element: <UserLayout />,
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard', element: <UserDashboardPage /> },
      { path: 'perfil', element: <ProfilePage /> },
      { path: 'beneficios', element: <MyBenefitsPage /> },
      { path: 'solicitacoes', element: <ApplicationsPage /> },
      { path: 'solicitacoes/:id', element: <ApplicationDetailPage /> },
      { path: 'historico', element: <HistoryPage /> },
    ],
  },
  { path: '/admin', element: <AdminIndex /> },
  { path: '/admin/login', element: <AdminLoginPage /> },
  { path: '/admin/recuperar-senha', element: <ForgotPasswordPage admin /> },
  { path: '/admin/redefinir-senha', element: <ResetPasswordPage admin /> },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { path: 'dashboard', element: <AdminDashboardPage /> },
      { path: 'usuarios', element: <Guard permission="users:read"><AdminUsersPage /></Guard> },
      { path: 'beneficios', element: <Guard permission="benefits:read"><AdminBenefitsPage /></Guard> },
      { path: 'solicitacoes', element: <Guard permission="applications:read"><AdminApplicationsPage /></Guard> },
      { path: 'solicitacoes/:id', element: <Guard permission="applications:read"><AdminApplicationDetailPage /></Guard> },
      { path: 'noticias', element: <Guard permission="news:read"><AdminNewsPage /></Guard> },
      { path: 'administradores', element: <Guard permission="admins:manage"><AdminAdminsPage /></Guard> },
      { path: 'atividades', element: <Guard permission="activities:read"><AdminActivitiesPage /></Guard> },
      { path: 'configuracoes', element: <Guard permission="settings:read"><AdminSettingsPage /></Guard> },
      { path: '*', element: <NotFound /> },
    ],
  },
];

export const router = createBrowserRouter(routes);

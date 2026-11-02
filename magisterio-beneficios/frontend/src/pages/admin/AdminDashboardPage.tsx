import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, FileText, Gift, UserCheck, Users, XCircle } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ErrorState, Spinner } from '../../components/feedback';
import { Card, CardHeader, PageHeader, StatCard } from '../../components/ui';
import { useDocumentTitle } from '../../hooks/common';
import { api } from '../../services/api';
import type { Activity, ApplicationStatus } from '../../types';
import { STATUS_LABEL, formatDateTime } from '../../utils/format';

interface Dashboard {
  totals: { users: number; activeUsers: number; publishedBenefits: number; applications: number; pending: number; approved: number; refused: number };
  registrations: { month: string; total: number }[];
  applicationsByMonth: { month: string; total: number }[];
  statusDistribution: { status: ApplicationStatus; total: number }[];
  topBenefits: { name: string; total: number }[];
  recentActivities: Activity[];
}

const STATUS_COLOR: Record<ApplicationStatus, string> = {
  PENDENTE: '#94a3b8', EM_ANALISE: '#2a5298', AGUARDANDO_DOCUMENTACAO: '#d97706', APROVADA: '#2fa56f', RECUSADA: '#dc2626', CONCLUIDA: '#0f2548',
};

export default function AdminDashboardPage() {
  useDocumentTitle('Dashboard');
  const q = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: () => api.get<Dashboard>('/admin/dashboard') });
  if (q.isLoading) return <Spinner />;
  if (q.isError || !q.data) return <ErrorState message="Não foi possível carregar o dashboard." onRetry={() => q.refetch()} />;
  const d = q.data;
  const t = d.totals;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Indicadores calculados a partir dos dados do banco, em tempo real." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Usuários cadastrados" value={t.users} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Professores ativos" value={t.activeUsers} icon={<UserCheck className="h-5 w-5" />} tone="green" />
        <StatCard label="Benefícios publicados" value={t.publishedBenefits} icon={<Gift className="h-5 w-5" />} />
        <StatCard label="Solicitações recebidas" value={t.applications} icon={<FileText className="h-5 w-5" />} />
        <StatCard label="Pendentes" value={t.pending} icon={<Clock className="h-5 w-5" />} tone="amber" />
        <StatCard label="Aprovadas" value={t.approved} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
        <StatCard label="Recusadas" value={t.refused} icon={<XCircle className="h-5 w-5" />} tone="red" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Evolução de cadastros (6 meses)" />
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d.registrations}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="month" fontSize={12} /><YAxis allowDecimals={false} fontSize={12} /><Tooltip />
                <Line type="monotone" dataKey="total" name="Cadastros" stroke="#14305f" strokeWidth={2} dot /></LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title="Solicitações por período (6 meses)" />
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.applicationsByMonth}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="month" fontSize={12} /><YAxis allowDecimals={false} fontSize={12} /><Tooltip />
                <Bar dataKey="total" name="Solicitações" fill="#2fa56f" radius={[4, 4, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title="Solicitações por situação" />
          <div className="h-64 p-4">
            {d.statusDistribution.length === 0 ? <p className="py-20 text-center text-sm text-slate-500">Sem solicitações.</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={d.statusDistribution.map((s) => ({ ...s, name: STATUS_LABEL[s.status] }))} dataKey="total" nameKey="name" innerRadius={50} outerRadius={85}>
                  {d.statusDistribution.map((s) => <Cell key={s.status} fill={STATUS_COLOR[s.status]} />)}</Pie><Tooltip /><Legend wrapperStyle={{ fontSize: 12 }} /></PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Benefícios mais solicitados" />
          <div className="h-64 p-4">
            {d.topBenefits.length === 0 ? <p className="py-20 text-center text-sm text-slate-500">Sem solicitações.</p> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.topBenefits} layout="vertical" margin={{ left: 20 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis type="number" allowDecimals={false} fontSize={12} />
                  <YAxis type="category" dataKey="name" width={130} fontSize={11} tickFormatter={(v: string) => (v.length > 20 ? `${v.slice(0, 20)}…` : v)} /><Tooltip />
                  <Bar dataKey="total" name="Solicitações" fill="#14305f" radius={[0, 4, 4, 0]} /></BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {d.recentActivities.length > 0 && (
        <Card>
          <CardHeader title="Atividades administrativas recentes" />
          <ul className="divide-y divide-slate-100">
            {d.recentActivities.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 px-5 py-3 text-sm">
                <span><strong className="text-navy-800">{a.admin?.name ?? 'Sistema'}</strong> · {a.action.toLowerCase().replace(/_/g, ' ')} em {a.module}{a.details ? ` — ${a.details}` : ''}</span>
                <span className="text-xs text-slate-500">{formatDateTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

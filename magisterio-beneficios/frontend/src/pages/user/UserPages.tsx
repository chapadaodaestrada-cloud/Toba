import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Paperclip, Upload, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import type { z } from 'zod';
import { RichText, StatusBadge } from '../../components/common';
import { EmptyState, ErrorState, Spinner, useToast } from '../../components/feedback';
import { BenefitCard } from '../../components/public';
import { Button, Card, CardHeader, Field, Input, PageHeader, Select, StatCard } from '../../components/ui';
import { useDocumentTitle } from '../../hooks/common';
import { useUserAuth } from '../../hooks/useAuth';
import { changePasswordSchema, profileSchema } from '../../schemas';
import { ApiError, api } from '../../services/api';
import type { Application, ApplicationRow, ApplicationStatus, Benefit, HistoryEntry, News, Paged, UserProfile } from '../../types';
import { STATES, STATUS_LABEL, formatDate, formatDateTime, maskCpf, toDateInput } from '../../utils/format';

interface DashboardData {
  user: UserProfile;
  applicationsByStatus: Record<string, number>;
  recentHistory: (HistoryEntry & { application: { protocol: string; benefit: { name: string } } })[];
  availableBenefits: Benefit[];
  news: News[];
}

export function UserDashboardPage() {
  useDocumentTitle('Resumo');
  const { me } = useUserAuth();
  const q = useQuery({ queryKey: ['user', 'dashboard'], queryFn: () => api.get<DashboardData>('/me/profile/dashboard') });
  if (q.isLoading) return <Spinner />;
  if (q.isError || !q.data) return <ErrorState message="Não foi possível carregar o resumo." onRetry={() => q.refetch()} />;
  const d = q.data;
  const count = (s: ApplicationStatus) => d.applicationsByStatus[s] ?? 0;
  const inProgress = count('PENDENTE') + count('EM_ANALISE') + count('AGUARDANDO_DOCUMENTACAO');
  const pendingDocs = count('AGUARDANDO_DOCUMENTACAO');

  return (
    <div className="space-y-6">
      <PageHeader title={`Olá, ${me?.name.split(' ')[0]}`} description="Veja o resumo da sua conta e das suas solicitações." />
      {pendingDocs > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Você tem {pendingDocs} solicitação(ões) aguardando documentação. <Link className="font-medium underline" to="/minha-conta/solicitacoes?status=AGUARDANDO_DOCUMENTACAO">Ver agora</Link>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Em andamento" value={inProgress} icon={<Paperclip className="h-5 w-5" />} />
        <StatCard label="Aprovadas" value={count('APROVADA') + count('CONCLUIDA')} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
        <StatCard label="Recusadas" value={count('RECUSADA')} icon={<XCircle className="h-5 w-5" />} tone="red" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Histórico recente" action={<Link className="text-sm text-navy-700 underline" to="/minha-conta/historico">Ver tudo</Link>} />
          {d.recentHistory.length === 0 ? <EmptyState title="Sem movimentações" description="Suas solicitações aparecerão aqui." /> : (
            <ul className="divide-y divide-slate-100">
              {d.recentHistory.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <div><div className="font-medium text-slate-800">{h.application.benefit.name}</div><div className="text-xs text-slate-500">{h.application.protocol} · {formatDateTime(h.createdAt)}</div></div>
                  <StatusBadge status={h.toStatus} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Resumo cadastral" action={<Link className="text-sm text-navy-700 underline" to="/minha-conta/perfil">Editar</Link>} />
          <dl className="space-y-2 p-5 text-sm">
            <div><dt className="text-xs text-slate-500">Nome</dt><dd>{d.user.name}</dd></div>
            <div><dt className="text-xs text-slate-500">E-mail</dt><dd>{d.user.email}</dd></div>
            <div><dt className="text-xs text-slate-500">Instituição</dt><dd>{d.user.institution || '—'}</dd></div>
            <div><dt className="text-xs text-slate-500">Cargo</dt><dd>{d.user.position || '—'}</dd></div>
          </dl>
        </Card>
      </div>
      <div>
        <h2 className="mb-3 text-lg font-semibold text-navy-900">Benefícios disponíveis</h2>
        {d.availableBenefits.length === 0 ? <p className="text-sm text-slate-500">Nenhum benefício publicado.</p> : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">{d.availableBenefits.map((b) => <BenefitCard key={b.id} b={b} />)}</div>
        )}
      </div>
      {d.news.length > 0 && (
        <Card>
          <CardHeader title="Comunicados importantes" />
          <ul className="divide-y divide-slate-100">
            {d.news.map((n) => (
              <li key={n.id} className="px-5 py-3 text-sm"><Link className="font-medium text-navy-800 hover:underline" to={`/noticias/${n.slug}`}>{n.title}</Link><div className="text-xs text-slate-500">{formatDate(n.publishedAt)}</div></li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof changePasswordSchema>;

export function ProfilePage() {
  useDocumentTitle('Meu perfil');
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['user', 'profile'], queryFn: () => api.get<UserProfile>('/me/profile') });
  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema) });
  const pw = useForm<PasswordValues>({ resolver: zodResolver(changePasswordSchema) });

  useEffect(() => {
    if (q.data) form.reset({ name: q.data.name, phone: q.data.phone, birthDate: toDateInput(q.data.birthDate), institution: q.data.institution ?? '', position: q.data.position ?? '', city: q.data.city ?? '', state: q.data.state ?? '' });
  }, [q.data, form]);

  const save = useMutation({
    mutationFn: (v: ProfileValues) => api.put('/me/profile', v),
    onSuccess: () => { toast.success('Dados atualizados'); qc.invalidateQueries({ queryKey: ['user'] }); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Erro ao salvar'),
  });
  const changePw = useMutation({
    mutationFn: (v: PasswordValues) => api.put('/me/profile/password', { currentPassword: v.currentPassword, newPassword: v.newPassword }),
    onSuccess: () => { toast.success('Senha alterada'); pw.reset(); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Erro ao alterar senha'),
  });

  if (q.isLoading) return <Spinner />;
  if (!q.data) return <ErrorState message="Não foi possível carregar o perfil." onRetry={() => q.refetch()} />;
  const e = form.formState.errors;
  return (
    <div className="space-y-6">
      <PageHeader title="Meu perfil" description="CPF e e-mail só podem ser alterados pelo atendimento, por segurança." />
      <Card>
        <CardHeader title="Dados cadastrais" />
        <form noValidate className="grid gap-4 p-5 sm:grid-cols-2" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
          <Field label="CPF"><Input value={maskCpf(q.data.cpf)} disabled readOnly /></Field>
          <Field label="E-mail"><Input value={q.data.email} disabled readOnly /></Field>
          <div className="sm:col-span-2"><Field label="Nome completo" required error={e.name?.message}><Input {...form.register('name')} /></Field></div>
          <Field label="Telefone" required error={e.phone?.message}><Input {...form.register('phone')} /></Field>
          <Field label="Data de nascimento"><Input type="date" {...form.register('birthDate')} /></Field>
          <Field label="Instituição"><Input {...form.register('institution')} /></Field>
          <Field label="Cargo / função"><Input {...form.register('position')} /></Field>
          <Field label="Cidade"><Input {...form.register('city')} /></Field>
          <Field label="UF"><Select {...form.register('state')}><option value="">—</option>{STATES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <div className="sm:col-span-2"><Button type="submit" loading={save.isPending}>Salvar alterações</Button></div>
        </form>
      </Card>
      <Card>
        <CardHeader title="Alterar senha" />
        <form noValidate className="grid gap-4 p-5 sm:grid-cols-3" onSubmit={pw.handleSubmit((v) => changePw.mutate(v))}>
          <Field label="Senha atual" error={pw.formState.errors.currentPassword?.message}><Input type="password" autoComplete="current-password" {...pw.register('currentPassword')} /></Field>
          <Field label="Nova senha" error={pw.formState.errors.newPassword?.message}><Input type="password" autoComplete="new-password" {...pw.register('newPassword')} /></Field>
          <Field label="Confirmar" error={pw.formState.errors.confirmPassword?.message}><Input type="password" autoComplete="new-password" {...pw.register('confirmPassword')} /></Field>
          <div className="sm:col-span-3"><Button type="submit" variant="secondary" loading={changePw.isPending}>Alterar senha</Button></div>
        </form>
      </Card>
    </div>
  );
}

export function MyBenefitsPage() {
  useDocumentTitle('Benefícios');
  const q = useQuery({ queryKey: ['user', 'benefits'], queryFn: () => api.get<Paged<Benefit>>('/public/benefits?pageSize=50') });
  return (
    <div>
      <PageHeader title="Benefícios disponíveis" description="Escolha um benefício para ver os detalhes e iniciar a solicitação." />
      {q.isLoading ? <Spinner /> : q.data?.items.length ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{q.data.items.map((b) => <BenefitCard key={b.id} b={b} />)}</div>
      ) : <EmptyState title="Nenhum benefício publicado" />}
    </div>
  );
}

export function ApplicationsPage() {
  useDocumentTitle('Solicitações');
  const [status, setStatus] = useState(new URLSearchParams(location.search).get('status') ?? '');
  const q = useQuery({ queryKey: ['user', 'applications', status], queryFn: () => api.get<ApplicationRow[]>(`/me/applications${status ? `?status=${status}` : ''}`) });
  return (
    <div>
      <PageHeader title="Minhas solicitações" action={<Link to="/minha-conta/beneficios"><Button>Nova solicitação</Button></Link>} />
      <div className="mb-4 max-w-xs">
        <Select aria-label="Filtrar por situação" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todas as situações</option>
          {(Object.keys(STATUS_LABEL) as ApplicationStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </Select>
      </div>
      <Card className="overflow-x-auto">
        {q.isLoading ? <Spinner /> : !q.data?.length ? (
          <EmptyState title="Nenhuma solicitação" description="Escolha um benefício para iniciar sua primeira solicitação." action={<Link to="/minha-conta/beneficios"><Button size="sm">Ver benefícios</Button></Link>} />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr><th className="px-4 py-3">Protocolo</th><th className="px-4 py-3">Benefício</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3" /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {q.data.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-mono text-xs">{a.protocol}</td><td className="px-4 py-3">{a.benefit.name}</td>
                  <td className="px-4 py-3">{formatDate(a.createdAt)}</td><td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                  <td className="px-4 py-3 text-right"><Link className="text-navy-700 underline" to={`/minha-conta/solicitacoes/${a.id}`}>Abrir</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

export function ApplicationDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const q = useQuery({ queryKey: ['user', 'application', id], queryFn: () => api.get<Application>(`/me/applications/${id}`) });
  useDocumentTitle(q.data ? q.data.protocol : 'Solicitação');
  const upload = useMutation({
    mutationFn: (file: File) => { const fd = new FormData(); fd.append('file', file); return api.post(`/me/applications/${id}/documents`, fd); },
    onSuccess: () => { toast.success('Documento enviado'); qc.invalidateQueries({ queryKey: ['user'] }); if (fileRef.current) fileRef.current.value = ''; },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Erro ao enviar documento'),
  });
  if (q.isLoading) return <Spinner />;
  if (q.isError || !q.data) return <ErrorState message="Solicitação não encontrada." />;
  const a = q.data;
  const canUpload = ['PENDENTE', 'EM_ANALISE', 'AGUARDANDO_DOCUMENTACAO'].includes(a.status);
  return (
    <div className="space-y-6">
      <Link to="/minha-conta/solicitacoes" className="inline-flex items-center gap-1 text-sm text-navy-700"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
      <PageHeader title={a.benefit.name} description={`Protocolo ${a.protocol} · aberta em ${formatDate(a.createdAt)}`} action={<StatusBadge status={a.status} />} />
      {a.status === 'AGUARDANDO_DOCUMENTACAO' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">O atendimento solicitou documentação complementar. Veja a observação no histórico e anexe os arquivos abaixo.</div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Histórico e observações" />
          <ol className="divide-y divide-slate-100">
            {a.history.map((h) => (
              <li key={h.id} className="px-5 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2"><StatusBadge status={h.toStatus} /><span className="text-xs text-slate-500">{formatDateTime(h.createdAt)}</span></div>
                {h.note && <p className="mt-2 text-slate-700">{h.note}</p>}
              </li>
            ))}
          </ol>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Documentos" />
            <div className="space-y-3 p-5 text-sm">
              {a.documents.length === 0 && <p className="text-slate-500">Nenhum documento anexado.</p>}
              {a.documents.map((d) => (
                <a key={d.id} href={`/api/me/applications/${a.id}/documents/${d.id}`} className="flex items-center gap-2 text-navy-700 hover:underline"><Paperclip className="h-4 w-4" />{d.originalName}</a>
              ))}
              {canUpload && (
                <div className="border-t border-slate-100 pt-3">
                  <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" aria-label="Selecionar documento"
                    onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
                  <Button variant="secondary" size="sm" loading={upload.isPending} onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Anexar documento</Button>
                  <p className="mt-2 text-xs text-slate-500">PDF, JPG ou PNG.</p>
                </div>
              )}
            </div>
          </Card>
          {a.message && <Card><CardHeader title="Sua observação" /><div className="p-5 text-sm"><RichText text={a.message} /></div></Card>}
        </div>
      </div>
    </div>
  );
}

export function HistoryPage() {
  useDocumentTitle('Histórico');
  const q = useQuery({
    queryKey: ['user', 'history'],
    queryFn: () => api.get<(HistoryEntry & { application: { id: string; protocol: string; benefit: { name: string } } })[]>('/me/applications/history/all'),
  });
  return (
    <div>
      <PageHeader title="Histórico" description="Todas as movimentações das suas solicitações." />
      <Card>
        {q.isLoading ? <Spinner /> : !q.data?.length ? <EmptyState title="Sem movimentações" /> : (
          <ul className="divide-y divide-slate-100">
            {q.data.map((h) => (
              <li key={h.id} className="flex flex-wrap items-start justify-between gap-2 px-5 py-3 text-sm">
                <div>
                  <Link className="font-medium text-navy-800 hover:underline" to={`/minha-conta/solicitacoes/${h.application.id}`}>{h.application.benefit.name}</Link>
                  <div className="text-xs text-slate-500">{h.application.protocol} · {formatDateTime(h.createdAt)}</div>
                  {h.note && <p className="mt-1 text-slate-700">{h.note}</p>}
                </div>
                <StatusBadge status={h.toStatus} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

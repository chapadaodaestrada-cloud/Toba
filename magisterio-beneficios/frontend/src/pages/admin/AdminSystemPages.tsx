import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { EmptyState, ErrorState, Pagination, Spinner, useToast } from '../../components/feedback';
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader, Select, Textarea } from '../../components/ui';
import { useDocumentTitle } from '../../hooks/common';
import { can, useAdminAuth } from '../../hooks/useAuth';
import { settingsSchema } from '../../schemas';
import { ApiError, api, qs } from '../../services/api';
import type { Activity, Paged, Settings } from '../../types';
import { formatDateTime } from '../../utils/format';

export function AdminActivitiesPage() {
  useDocumentTitle('Atividades');
  const [page, setPage] = useState(1);
  const [module, setModule] = useState('');
  const q = useQuery({ queryKey: ['admin', 'activities', module, page], queryFn: () => api.get<Paged<Activity> & { modules: string[] }>(`/admin/activities${qs({ module, page })}`) });
  return (
    <div>
      <PageHeader title="Histórico de atividades" description="Registro de auditoria das ações administrativas. Os registros são somente leitura." />
      <Card>
        <div className="border-b border-slate-100 p-4 sm:max-w-xs">
          <Select aria-label="Módulo" value={module} onChange={(e) => { setModule(e.target.value); setPage(1); }}><option value="">Todos os módulos</option>{q.data?.modules.map((m) => <option key={m}>{m}</option>)}</Select>
        </div>
        {q.isLoading ? <Spinner /> : q.isError ? <ErrorState message="Erro ao carregar." onRetry={() => q.refetch()} /> : !q.data?.items.length ? <EmptyState title="Nenhuma atividade registrada" /> : (
          <>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr><th className="px-4 py-3">Data/hora</th><th className="px-4 py-3">Administrador</th><th className="px-4 py-3">Ação</th><th className="px-4 py-3">Módulo</th><th className="px-4 py-3">Detalhes</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {q.data.items.map((a) => (
                  <tr key={a.id}><td className="px-4 py-3 whitespace-nowrap">{formatDateTime(a.createdAt)}</td><td className="px-4 py-3">{a.admin?.name ?? 'Sistema'}</td>
                    <td className="px-4 py-3"><Badge tone="navy">{a.action.toLowerCase().replace(/_/g, ' ')}</Badge></td><td className="px-4 py-3">{a.module}</td><td className="px-4 py-3 text-slate-600">{a.details ?? '—'}</td></tr>
                ))}
              </tbody></table></div>
            <Pagination page={q.data.page} totalPages={q.data.totalPages} total={q.data.total} onChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}

type Values = z.infer<typeof settingsSchema>;

export function AdminSettingsPage() {
  useDocumentTitle('Configurações');
  const { me } = useAdminAuth();
  const canWrite = can(me, 'settings:write');
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => api.get<Settings>('/admin/settings') });
  const form = useForm({ resolver: zodResolver(settingsSchema) });
  useEffect(() => {
    if (q.data) form.reset({
      platformName: q.data.platformName, logoUrl: q.data.logoUrl ?? '', about: q.data.about, contactEmail: q.data.contactEmail, contactPhone: q.data.contactPhone,
      address: q.data.address, instagram: q.data.instagram ?? '', facebook: q.data.facebook ?? '', youtube: q.data.youtube ?? '', maxUploadMb: q.data.maxUploadMb ?? 5,
      notifyNewApplication: q.data.notifyNewApplication ?? true, notifyStatusChange: q.data.notifyStatusChange ?? true, maintenanceMode: q.data.maintenanceMode,
    });
  }, [q.data, form]);
  const save = useMutation({
    mutationFn: (v: Values) => api.put('/admin/settings', v),
    onSuccess: () => { toast.success('Configurações salvas'); qc.invalidateQueries(); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Erro ao salvar'),
  });
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorState message="Erro ao carregar." onRetry={() => q.refetch()} />;
  const er = form.formState.errors;
  const ro = !canWrite;
  return (
    <div>
      <PageHeader title="Configurações gerais" description={canWrite ? undefined : 'Você tem acesso somente leitura.'} />
      <form noValidate className="space-y-6" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
        <Card>
          <CardHeader title="Identidade e institucional" />
          <fieldset disabled={ro} className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Nome da plataforma" error={er.platformName?.message}><Input {...form.register('platformName')} /></Field>
            <Field label="URL do logotipo" error={er.logoUrl?.message} hint="Endereço de imagem já hospedada"><Input placeholder="https://" {...form.register('logoUrl')} /></Field>
            <div className="sm:col-span-2"><Field label="Informações institucionais" error={er.about?.message}><Textarea {...form.register('about')} /></Field></div>
          </fieldset>
        </Card>
        <Card>
          <CardHeader title="Contato e redes sociais" />
          <fieldset disabled={ro} className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="E-mail de contato" error={er.contactEmail?.message}><Input {...form.register('contactEmail')} /></Field>
            <Field label="Telefone"><Input {...form.register('contactPhone')} /></Field>
            <div className="sm:col-span-2"><Field label="Endereço"><Input {...form.register('address')} /></Field></div>
            <Field label="Instagram" error={er.instagram?.message}><Input placeholder="https://" {...form.register('instagram')} /></Field>
            <Field label="Facebook" error={er.facebook?.message}><Input placeholder="https://" {...form.register('facebook')} /></Field>
            <Field label="YouTube" error={er.youtube?.message}><Input placeholder="https://" {...form.register('youtube')} /></Field>
          </fieldset>
        </Card>
        <Card>
          <CardHeader title="Parâmetros e notificações" />
          <fieldset disabled={ro} className="space-y-3 p-5">
            <div className="max-w-xs"><Field label="Tamanho máximo de upload (MB)" error={er.maxUploadMb?.message}><Input type="number" min={1} max={10} {...form.register('maxUploadMb')} /></Field></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register('notifyNewApplication')} /> Notificar equipe sobre novas solicitações</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register('notifyStatusChange')} /> Notificar usuário sobre mudança de situação</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register('maintenanceMode')} /> Modo de manutenção</label>
            <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">As preferências de notificação são armazenadas, mas o envio de e-mails depende de integração SMTP que ainda não está configurada. O modo de manutenção é apenas um indicador e não bloqueia o portal.</p>
          </fieldset>
        </Card>
        {canWrite && <Button type="submit" loading={save.isPending}>Salvar configurações</Button>}
      </form>
    </div>
  );
}

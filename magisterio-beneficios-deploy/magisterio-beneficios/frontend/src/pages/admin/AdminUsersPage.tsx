import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { StatusBadge } from '../../components/common';
import { ConfirmDialog, EmptyState, ErrorState, Modal, Pagination, Spinner, useToast } from '../../components/feedback';
import { Badge, Button, Card, Field, Input, PageHeader, Select } from '../../components/ui';
import { useDebounced, useDocumentTitle } from '../../hooks/common';
import { can, useAdminAuth } from '../../hooks/useAuth';
import { profileFields } from '../../schemas';
import { ApiError, api, qs } from '../../services/api';
import type { Activity, ApplicationStatus, Paged, UserProfile } from '../../types';
import { STATES, formatDate, formatDateTime, maskCpfPrivate, toDateInput } from '../../utils/format';

const editSchema = z.object({ ...profileFields, email: z.string().email('E-mail inválido') });
type EditValues = z.infer<typeof editSchema>;

interface UserDetail extends UserProfile {
  applications: { id: string; protocol: string; status: ApplicationStatus; createdAt: string; benefit: { name: string } }[];
  activities: (Activity)[];
}

function UserModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { me } = useAdminAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const canWrite = can(me, 'users:write');
  const q = useQuery({ queryKey: ['admin', 'user', id], queryFn: () => api.get<UserDetail>(`/admin/users/${id}`) });
  const form = useForm<EditValues>({ resolver: zodResolver(editSchema) });
  useEffect(() => {
    if (q.data) form.reset({ name: q.data.name, email: q.data.email, phone: q.data.phone, birthDate: toDateInput(q.data.birthDate), institution: q.data.institution ?? '', position: q.data.position ?? '', city: q.data.city ?? '', state: q.data.state ?? '' });
  }, [q.data, form]);
  const done = () => { qc.invalidateQueries({ queryKey: ['admin'] }); };
  const save = useMutation({
    mutationFn: (v: EditValues) => api.put(`/admin/users/${id}`, v),
    onSuccess: () => { toast.success('Cadastro atualizado'); setEditing(false); done(); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Erro ao salvar'),
  });
  const toggle = useMutation({
    mutationFn: (active: boolean) => api.post(`/admin/users/${id}/active`, { active }),
    onSuccess: (_d, active) => { toast.success(active ? 'Usuário ativado' : 'Usuário desativado'); setConfirm(false); done(); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Erro'),
  });
  const u = q.data;
  const e = form.formState.errors;
  return (
    <Modal open onClose={onClose} title="Usuário" wide>
      {q.isLoading || !u ? <Spinner /> : (
        <div className="space-y-5">
          {editing ? (
            <form noValidate className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
              <div className="sm:col-span-2"><Field label="Nome" error={e.name?.message}><Input {...form.register('name')} /></Field></div>
              <Field label="E-mail" error={e.email?.message}><Input {...form.register('email')} /></Field>
              <Field label="Telefone" error={e.phone?.message}><Input {...form.register('phone')} /></Field>
              <Field label="Instituição"><Input {...form.register('institution')} /></Field>
              <Field label="Cargo"><Input {...form.register('position')} /></Field>
              <Field label="Cidade"><Input {...form.register('city')} /></Field>
              <Field label="UF"><Select {...form.register('state')}><option value="">—</option>{STATES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
              <div className="flex gap-2 sm:col-span-2"><Button type="submit" loading={save.isPending}>Salvar</Button><Button type="button" variant="secondary" onClick={() => setEditing(false)}>Cancelar</Button></div>
            </form>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h3 className="text-lg font-semibold text-navy-900">{u.name}</h3><p className="text-sm text-slate-500">CPF {maskCpfPrivate(u.cpf)} · cadastrado em {formatDate(u.createdAt)}</p></div>
                <Badge tone={u.active ? 'green' : 'red'}>{u.active ? 'Ativo' : 'Inativo'}</Badge>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-slate-500">E-mail</dt><dd>{u.email}</dd></div>
                <div><dt className="text-xs text-slate-500">Telefone</dt><dd>{u.phone}</dd></div>
                <div><dt className="text-xs text-slate-500">Instituição</dt><dd>{u.institution || '—'}</dd></div>
                <div><dt className="text-xs text-slate-500">Cargo</dt><dd>{u.position || '—'}</dd></div>
                <div><dt className="text-xs text-slate-500">Localidade</dt><dd>{[u.city, u.state].filter(Boolean).join(' / ') || '—'}</dd></div>
                <div><dt className="text-xs text-slate-500">Último acesso</dt><dd>{formatDateTime(u.lastLoginAt)}</dd></div>
              </dl>
              {canWrite && (
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>Editar cadastro</Button>
                  <Button variant={u.active ? 'danger' : 'success'} size="sm" onClick={() => setConfirm(true)}>{u.active ? 'Desativar' : 'Ativar'}</Button>
                </div>
              )}
            </>
          )}
          <div>
            <h4 className="mb-2 text-sm font-semibold text-navy-800">Histórico de solicitações</h4>
            {u.applications.length === 0 ? <p className="text-sm text-slate-500">Nenhuma solicitação.</p> : (
              <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
                {u.applications.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span><Link className="text-navy-700 underline" to={`/admin/solicitacoes/${a.id}`}>{a.protocol}</Link> · {a.benefit.name}</span>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold text-navy-800">Atividades administrativas relacionadas</h4>
            {u.activities.length === 0 ? <p className="text-sm text-slate-500">Nenhuma atividade registrada.</p> : (
              <ul className="space-y-1 text-sm text-slate-700">{u.activities.map((a) => <li key={a.id}>{formatDateTime(a.createdAt)} — {a.admin?.name}: {a.action.toLowerCase().replace(/_/g, ' ')}</li>)}</ul>
            )}
          </div>
          <ConfirmDialog open={confirm} danger={u.active} title={u.active ? 'Desativar usuário' : 'Ativar usuário'}
            message={u.active ? 'O usuário perderá o acesso à plataforma. Os dados e o histórico são mantidos.' : 'O usuário voltará a ter acesso à plataforma.'}
            confirmLabel={u.active ? 'Desativar' : 'Ativar'} loading={toggle.isPending} onConfirm={() => toggle.mutate(!u.active)} onClose={() => setConfirm(false)} />
        </div>
      )}
    </Modal>
  );
}

export default function AdminUsersPage() {
  useDocumentTitle('Usuários');
  const [q, setQ] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const dq = useDebounced(q);
  const list = useQuery({ queryKey: ['admin', 'users', dq, active, page], queryFn: () => api.get<Paged<UserProfile>>(`/admin/users${qs({ q: dq, active, page })}`) });
  return (
    <div>
      <PageHeader title="Usuários" description="Professores e demais usuários cadastrados. O CPF é exibido de forma parcial." />
      <Card>
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-3">
          <div className="relative sm:col-span-2"><Search className="absolute top-3 left-3 h-4 w-4 text-slate-400" /><Input className="pl-9" placeholder="Buscar por nome, e-mail ou CPF" aria-label="Buscar usuários" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
          <Select aria-label="Situação" value={active} onChange={(e) => { setActive(e.target.value); setPage(1); }}><option value="">Todos</option><option value="true">Ativos</option><option value="false">Inativos</option></Select>
        </div>
        {list.isLoading ? <Spinner /> : list.isError ? <ErrorState message="Erro ao carregar usuários." onRetry={() => list.refetch()} /> : !list.data?.items.length ? <EmptyState title="Nenhum usuário encontrado" /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">CPF</th><th className="px-4 py-3">E-mail</th><th className="px-4 py-3">Solic.</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3" /></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {list.data.items.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-800">{u.name}</td><td className="px-4 py-3 font-mono text-xs">{maskCpfPrivate(u.cpf)}</td>
                      <td className="px-4 py-3">{u.email}</td><td className="px-4 py-3">{u._count?.applications ?? 0}</td>
                      <td className="px-4 py-3"><Badge tone={u.active ? 'green' : 'red'}>{u.active ? 'Ativo' : 'Inativo'}</Badge></td>
                      <td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" onClick={() => setSelected(u.id)}><Eye className="h-4 w-4" /> Ver</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={list.data.page} totalPages={list.data.totalPages} total={list.data.total} onChange={setPage} />
          </>
        )}
      </Card>
      {selected && <UserModal id={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

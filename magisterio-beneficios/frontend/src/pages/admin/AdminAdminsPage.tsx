import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Power } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { ConfirmDialog, EmptyState, ErrorState, Modal, Pagination, Spinner, useToast } from '../../components/feedback';
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader, Select } from '../../components/ui';
import { useDocumentTitle } from '../../hooks/common';
import { adminSchema } from '../../schemas';
import { ApiError, api } from '../../services/api';
import type { AdminAccount, Activity, Paged } from '../../types';
import { formatDateTime } from '../../utils/format';

type Values = z.infer<typeof adminSchema>;
interface Roles { permissions: { key: string; label: string }[]; roles: { id: number; key: string; name: string; description: string; admins: number; permissions: string[] }[] }

function AdminForm({ item, onClose }: { item: AdminAccount | null; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const form = useForm<Values>({ resolver: zodResolver(adminSchema), defaultValues: { name: '', email: '', roleKey: 'OPERADOR', password: '' } });
  const detail = useQuery({ queryKey: ['admin', 'admin-detail', item?.id], enabled: !!item, queryFn: () => api.get<AdminAccount & { activities: Activity[] }>(`/admin/admins/${item!.id}`) });
  useEffect(() => { if (item) form.reset({ name: item.name, email: item.email, roleKey: item.role.key as Values['roleKey'], password: '' }); }, [item, form]);
  const save = useMutation({
    mutationFn: (v: Values) => (item ? api.put(`/admin/admins/${item.id}`, v) : api.post('/admin/admins', v)),
    onSuccess: () => { toast.success('Administrador salvo'); qc.invalidateQueries({ queryKey: ['admin'] }); onClose(); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Erro ao salvar'),
  });
  const er = form.formState.errors;
  return (
    <Modal open onClose={onClose} title={item ? 'Editar administrador' : 'Novo administrador'}>
      <form noValidate className="space-y-4" onSubmit={form.handleSubmit((v) => {
        if (!item && !v.password) { form.setError('password', { message: 'Informe a senha inicial' }); return; }
        save.mutate(v);
      })}>
        <Field label="Nome" required error={er.name?.message}><Input {...form.register('name')} /></Field>
        <Field label="E-mail" required error={er.email?.message}><Input type="email" {...form.register('email')} /></Field>
        <Field label="Perfil" required><Select {...form.register('roleKey')}><option value="OPERADOR">Operador</option><option value="ADMIN">Administrador</option><option value="SUPER_ADMIN">Super administrador</option></Select></Field>
        <Field label={item ? 'Nova senha (opcional)' : 'Senha inicial'} required={!item} error={er.password?.message}><Input type="password" autoComplete="new-password" {...form.register('password')} /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" loading={save.isPending}>Salvar</Button></div>
      </form>
      {item && (
        <div className="mt-6 border-t border-slate-100 pt-4">
          <h4 className="mb-2 text-sm font-semibold text-navy-800">Histórico de atividades</h4>
          {detail.isLoading ? <Spinner /> : !detail.data?.activities.length ? <p className="text-sm text-slate-500">Nenhuma atividade.</p> : (
            <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-slate-700">{detail.data.activities.map((a) => <li key={a.id}>{formatDateTime(a.createdAt)} — {a.action.toLowerCase().replace(/_/g, ' ')} em {a.module}</li>)}</ul>
          )}
        </div>
      )}
    </Modal>
  );
}

function RolesPanel() {
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'roles'], queryFn: () => api.get<Roles>('/admin/admins/roles') });
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const save = useMutation({
    mutationFn: ({ key, permissions }: { key: string; permissions: string[] }) => api.put(`/admin/admins/roles/${key}`, { permissions }),
    onSuccess: () => { toast.success('Permissões atualizadas'); qc.invalidateQueries({ queryKey: ['admin', 'roles'] }); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Erro ao salvar'),
  });
  if (q.isLoading) return <Spinner />;
  if (!q.data) return null;
  return (
    <Card className="mt-6">
      <CardHeader title="Perfis e permissões" />
      <div className="grid gap-5 p-5 md:grid-cols-3">
        {q.data.roles.map((r) => {
          const current = draft[r.key] ?? r.permissions;
          const fixed = r.key === 'SUPER_ADMIN';
          const dirty = draft[r.key] !== undefined;
          return (
            <div key={r.key} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between"><h3 className="font-semibold text-navy-900">{r.name}</h3><Badge tone="gray">{r.admins} admin(s)</Badge></div>
              <p className="mt-1 mb-3 text-xs text-slate-500">{r.description}</p>
              <ul className="space-y-1.5">
                {q.data.permissions.map((p) => (
                  <li key={p.key}><label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" disabled={fixed} checked={current.includes(p.key)}
                      onChange={(e) => setDraft({ ...draft, [r.key]: e.target.checked ? [...current, p.key] : current.filter((k) => k !== p.key) })} />{p.label}
                  </label></li>
                ))}
              </ul>
              {!fixed && <Button size="sm" className="mt-4" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate({ key: r.key, permissions: current }, { onSuccess: () => setDraft((d) => { const n = { ...d }; delete n[r.key]; return n; }) })}>Salvar permissões</Button>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function AdminAdminsPage() {
  useDocumentTitle('Administradores');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AdminAccount | 'new' | null>(null);
  const [toggling, setToggling] = useState<AdminAccount | null>(null);
  const toast = useToast();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['admin', 'admins', page], queryFn: () => api.get<Paged<AdminAccount>>(`/admin/admins?page=${page}`) });
  const toggle = useMutation({
    mutationFn: (a: AdminAccount) => api.post(`/admin/admins/${a.id}/active`, { active: !a.active }),
    onSuccess: () => { toast.success('Situação atualizada'); setToggling(null); qc.invalidateQueries({ queryKey: ['admin'] }); },
    onError: (e) => { toast.error(e instanceof ApiError ? e.message : 'Erro'); setToggling(null); },
  });
  return (
    <div>
      <PageHeader title="Administradores" description="Gerencie quem acessa o painel e quais permissões cada perfil possui." action={<Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Novo administrador</Button>} />
      <Card>
        {list.isLoading ? <Spinner /> : list.isError ? <ErrorState message="Erro ao carregar." onRetry={() => list.refetch()} /> : !list.data?.items.length ? <EmptyState title="Nenhum administrador" /> : (
          <>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">E-mail</th><th className="px-4 py-3">Perfil</th><th className="px-4 py-3">Último acesso</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3" /></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {list.data.items.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{a.name}</td><td className="px-4 py-3">{a.email}</td><td className="px-4 py-3"><Badge tone="navy">{a.role.name}</Badge></td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(a.lastLoginAt)}</td><td className="px-4 py-3"><Badge tone={a.active ? 'green' : 'red'}>{a.active ? 'Ativo' : 'Inativo'}</Badge></td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(a)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => setToggling(a)} aria-label={a.active ? 'Desativar' : 'Ativar'}><Power className={`h-4 w-4 ${a.active ? 'text-red-600' : 'text-brand-600'}`} /></Button>
                    </div></td>
                  </tr>
                ))}
              </tbody></table></div>
            <Pagination page={list.data.page} totalPages={list.data.totalPages} total={list.data.total} onChange={setPage} />
          </>
        )}
      </Card>
      <RolesPanel />
      {editing && <AdminForm item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog open={!!toggling} danger={toggling?.active} title={toggling?.active ? 'Desativar administrador' : 'Ativar administrador'}
        message={toggling?.active ? <>{toggling.name} perderá o acesso ao painel imediatamente.</> : <>{toggling?.name} voltará a acessar o painel.</>}
        confirmLabel={toggling?.active ? 'Desativar' : 'Ativar'} loading={toggle.isPending} onConfirm={() => toggling && toggle.mutate(toggling)} onClose={() => setToggling(null)} />
    </div>
  );
}

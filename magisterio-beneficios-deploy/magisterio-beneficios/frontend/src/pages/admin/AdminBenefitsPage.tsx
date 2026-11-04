import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { ConfirmDialog, EmptyState, ErrorState, Modal, Pagination, Spinner, useToast } from '../../components/feedback';
import { Badge, Button, Card, Field, Input, PageHeader, Select, Textarea } from '../../components/ui';
import { useDebounced, useDocumentTitle } from '../../hooks/common';
import { can, useAdminAuth } from '../../hooks/useAuth';
import { benefitSchema } from '../../schemas';
import { ApiError, api, qs } from '../../services/api';
import type { Benefit, Category, Paged } from '../../types';
import { AVAILABILITY_LABEL, BENEFIT_STATUS_LABEL, formatDate, toDateInput } from '../../utils/format';

type Values = z.infer<typeof benefitSchema>;
const empty: Values = { name: '', summary: '', description: '', categoryId: '', targetAudience: '', requiredDocuments: '', imageUrl: '', startDate: '', endDate: '', requirements: '' };

function BenefitForm({ benefit, onClose }: { benefit: Benefit | null; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ['admin', 'benefit-cats'], queryFn: () => api.get<Category[]>('/admin/benefits/categories') });
  const [newCat, setNewCat] = useState('');
  const form = useForm<Values>({ resolver: zodResolver(benefitSchema), defaultValues: empty });
  useEffect(() => {
    form.reset(benefit ? {
      name: benefit.name, summary: benefit.summary, description: benefit.description, categoryId: String(benefit.categoryId),
      targetAudience: benefit.targetAudience, requiredDocuments: benefit.requiredDocuments, imageUrl: benefit.imageUrl ?? '',
      startDate: toDateInput(benefit.startDate), endDate: toDateInput(benefit.endDate), requirements: benefit.requirements.map((r) => r.text).join('\n'),
    } : empty);
  }, [benefit, form]);

  const save = useMutation({
    mutationFn: (v: Values) => {
      const body = { ...v, categoryId: Number(v.categoryId), requirements: v.requirements.split('\n').map((s) => s.trim()).filter(Boolean) };
      return benefit ? api.put(`/admin/benefits/${benefit.id}`, body) : api.post('/admin/benefits', body);
    },
    onSuccess: () => { toast.success(benefit ? 'Benefício atualizado' : 'Benefício criado como rascunho'); qc.invalidateQueries({ queryKey: ['admin'] }); onClose(); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Erro ao salvar'),
  });
  const addCat = useMutation({
    mutationFn: () => api.post<Category>('/admin/benefits/categories', { name: newCat }),
    onSuccess: (c) => { qc.invalidateQueries({ queryKey: ['admin', 'benefit-cats'] }); form.setValue('categoryId', String(c.id)); setNewCat(''); toast.success('Categoria criada'); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Erro ao criar categoria'),
  });
  const er = form.formState.errors;
  return (
    <Modal open onClose={onClose} title={benefit ? 'Editar benefício' : 'Novo benefício'} wide>
      <form noValidate className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
        <div className="sm:col-span-2"><Field label="Nome" required error={er.name?.message}><Input {...form.register('name')} /></Field></div>
        <div className="sm:col-span-2"><Field label="Resumo" required error={er.summary?.message} hint="Aparece nos cartões do catálogo (até 300 caracteres)"><Input {...form.register('summary')} /></Field></div>
        <div className="sm:col-span-2"><Field label="Descrição" required error={er.description?.message}><Textarea {...form.register('description')} /></Field></div>
        <Field label="Categoria" required error={er.categoryId?.message}>
          <Select {...form.register('categoryId')}><option value="">Selecione</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        </Field>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Nova categoria</span>
          <div className="flex gap-2"><Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Nome" aria-label="Nova categoria" />
            <Button type="button" variant="secondary" disabled={newCat.trim().length < 3} loading={addCat.isPending} onClick={() => addCat.mutate()}>Criar</Button></div>
        </div>
        <div className="sm:col-span-2"><Field label="Público elegível" required error={er.targetAudience?.message}><Input {...form.register('targetAudience')} /></Field></div>
        <div className="sm:col-span-2"><Field label="Documentação necessária" required error={er.requiredDocuments?.message}><Textarea className="min-h-20" {...form.register('requiredDocuments')} /></Field></div>
        <div className="sm:col-span-2"><Field label="Requisitos" hint="Um requisito por linha"><Textarea className="min-h-20" {...form.register('requirements')} /></Field></div>
        <div className="sm:col-span-2"><Field label="URL da imagem" error={er.imageUrl?.message} hint="Endereço de uma imagem já hospedada (upload de imagens depende de armazenamento externo)"><Input placeholder="https://" {...form.register('imageUrl')} /></Field></div>
        <Field label="Data de início"><Input type="date" {...form.register('startDate')} /></Field>
        <Field label="Data de encerramento" error={er.endDate?.message}><Input type="date" {...form.register('endDate')} /></Field>
        <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" loading={save.isPending}>Salvar</Button></div>
      </form>
    </Modal>
  );
}

export default function AdminBenefitsPage() {
  useDocumentTitle('Benefícios');
  const { me } = useAdminAuth();
  const canWrite = can(me, 'benefits:write');
  const toast = useToast();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Benefit | 'new' | null>(null);
  const [removing, setRemoving] = useState<Benefit | null>(null);
  const dq = useDebounced(q);
  const list = useQuery({ queryKey: ['admin', 'benefits', dq, status, page], queryFn: () => api.get<Paged<Benefit>>(`/admin/benefits${qs({ q: dq, status, page })}`) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin'] });
  const err = (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Erro na operação');
  const toggle = useMutation({
    mutationFn: (b: Benefit) => api.post(`/admin/benefits/${b.id}/${b.status === 'PUBLISHED' ? 'unpublish' : 'publish'}`),
    onSuccess: (_d, b) => { toast.success(b.status === 'PUBLISHED' ? 'Benefício despublicado' : 'Benefício publicado'); refresh(); }, onError: err,
  });
  const remove = useMutation({
    mutationFn: (b: Benefit) => api.delete(`/admin/benefits/${b.id}`),
    onSuccess: () => { toast.success('Benefício excluído'); setRemoving(null); refresh(); },
    onError: (e) => { err(e); setRemoving(null); },
  });
  return (
    <div>
      <PageHeader title="Benefícios" description="Cadastre, edite e publique os benefícios exibidos no portal." action={canWrite && <Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Novo benefício</Button>} />
      <Card>
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-3">
          <div className="relative sm:col-span-2"><Search className="absolute top-3 left-3 h-4 w-4 text-slate-400" /><Input className="pl-9" placeholder="Buscar por nome" aria-label="Buscar benefícios" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
          <Select aria-label="Situação" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">Todas as situações</option>{Object.entries(BENEFIT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        </div>
        {list.isLoading ? <Spinner /> : list.isError ? <ErrorState message="Erro ao carregar." onRetry={() => list.refetch()} /> : !list.data?.items.length ? <EmptyState title="Nenhum benefício" description="Crie o primeiro benefício." /> : (
          <>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr><th className="px-4 py-3">Benefício</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Vigência</th><th className="px-4 py-3">Solic.</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3" /></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {list.data.items.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{b.name}</td><td className="px-4 py-3">{b.category.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(b.startDate)} – {formatDate(b.endDate)}</td><td className="px-4 py-3">{b._count?.applications ?? 0}</td>
                    <td className="px-4 py-3"><Badge tone={b.status === 'PUBLISHED' ? 'green' : b.status === 'DRAFT' ? 'gray' : 'amber'}>{BENEFIT_STATUS_LABEL[b.status]}</Badge>{b.status === 'PUBLISHED' && <div className="mt-1 text-xs text-slate-500">{AVAILABILITY_LABEL[b.availability]}</div>}</td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-1">
                      {canWrite && <>
                        <Button variant="ghost" size="sm" onClick={() => toggle.mutate(b)} aria-label={b.status === 'PUBLISHED' ? 'Despublicar' : 'Publicar'} title={b.status === 'PUBLISHED' ? 'Despublicar' : 'Publicar'}>{b.status === 'PUBLISHED' ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditing(b)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => setRemoving(b)} aria-label="Excluir"><Trash2 className="h-4 w-4 text-red-600" /></Button>
                      </>}
                    </div></td>
                  </tr>
                ))}
              </tbody></table></div>
            <Pagination page={list.data.page} totalPages={list.data.totalPages} total={list.data.total} onChange={setPage} />
          </>
        )}
      </Card>
      {editing && <BenefitForm benefit={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog open={!!removing} danger title="Excluir benefício" confirmLabel="Excluir" loading={remove.isPending}
        message={<>Excluir <strong>{removing?.name}</strong>? Benefícios com solicitações vinculadas não podem ser excluídos — nesse caso, despublique-o.</>}
        onConfirm={() => removing && remove.mutate(removing)} onClose={() => setRemoving(null)} />
    </div>
  );
}

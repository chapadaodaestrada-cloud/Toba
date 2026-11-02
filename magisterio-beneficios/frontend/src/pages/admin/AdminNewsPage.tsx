import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Pencil, Plus, Search, Send, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { ConfirmDialog, EmptyState, ErrorState, Modal, Pagination, Spinner, useToast } from '../../components/feedback';
import { Badge, Button, Card, Field, Input, PageHeader, Select, Textarea } from '../../components/ui';
import { useDebounced, useDocumentTitle } from '../../hooks/common';
import { can, useAdminAuth } from '../../hooks/useAuth';
import { newsSchema } from '../../schemas';
import { ApiError, api, qs } from '../../services/api';
import type { Category, News, Paged } from '../../types';
import { NEWS_STATUS_LABEL, formatDateTime, toDateTimeInput } from '../../utils/format';

type Values = z.infer<typeof newsSchema>;
const empty: Values = { title: '', excerpt: '', content: '', categoryId: '', imageUrl: '', scheduledFor: '' };

function NewsForm({ item, onClose }: { item: News | null; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ['admin', 'news-cats'], queryFn: () => api.get<Category[]>('/admin/news/categories') });
  const [newCat, setNewCat] = useState('');
  const form = useForm<Values>({ resolver: zodResolver(newsSchema), defaultValues: empty });
  useEffect(() => {
    form.reset(item ? {
      title: item.title, excerpt: item.excerpt, content: item.content, categoryId: String(item.categoryId), imageUrl: item.imageUrl ?? '',
      scheduledFor: item.status === 'SCHEDULED' ? toDateTimeInput(item.publishedAt) : '',
    } : empty);
  }, [item, form]);
  const save = useMutation({
    mutationFn: (v: Values) => {
      const body = { ...v, categoryId: Number(v.categoryId), scheduledFor: v.scheduledFor ? new Date(v.scheduledFor).toISOString() : '' };
      return item ? api.put(`/admin/news/${item.id}`, body) : api.post('/admin/news', body);
    },
    onSuccess: () => { toast.success('Publicação salva'); qc.invalidateQueries({ queryKey: ['admin'] }); onClose(); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Erro ao salvar'),
  });
  const addCat = useMutation({
    mutationFn: () => api.post<Category>('/admin/news/categories', { name: newCat }),
    onSuccess: (c) => { qc.invalidateQueries({ queryKey: ['admin', 'news-cats'] }); form.setValue('categoryId', String(c.id)); setNewCat(''); toast.success('Categoria criada'); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Erro ao criar categoria'),
  });
  const er = form.formState.errors;
  return (
    <Modal open onClose={onClose} title={item ? 'Editar publicação' : 'Nova publicação'} wide>
      <form noValidate className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
        <div className="sm:col-span-2"><Field label="Título" required error={er.title?.message}><Input {...form.register('title')} /></Field></div>
        <div className="sm:col-span-2"><Field label="Resumo" required error={er.excerpt?.message}><Input {...form.register('excerpt')} /></Field></div>
        <div className="sm:col-span-2"><Field label="Conteúdo" required error={er.content?.message} hint='Texto simples. Use "## Título" para subtítulos, "- item" para listas e linha em branco para parágrafos.'><Textarea className="min-h-48" {...form.register('content')} /></Field></div>
        <Field label="Categoria" required error={er.categoryId?.message}><Select {...form.register('categoryId')}><option value="">Selecione</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <div><span className="mb-1.5 block text-sm font-medium text-slate-700">Nova categoria</span>
          <div className="flex gap-2"><Input value={newCat} onChange={(e) => setNewCat(e.target.value)} aria-label="Nova categoria" /><Button type="button" variant="secondary" disabled={newCat.trim().length < 3} loading={addCat.isPending} onClick={() => addCat.mutate()}>Criar</Button></div></div>
        <div className="sm:col-span-2"><Field label="URL da imagem de destaque" error={er.imageUrl?.message}><Input placeholder="https://" {...form.register('imageUrl')} /></Field></div>
        <div className="sm:col-span-2"><Field label="Programar publicação (opcional)" hint="Se preenchido, a publicação aparece no portal a partir desta data. Em branco: salva como rascunho."><Input type="datetime-local" {...form.register('scheduledFor')} /></Field></div>
        <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" loading={save.isPending}>Salvar</Button></div>
      </form>
    </Modal>
  );
}

export default function AdminNewsPage() {
  useDocumentTitle('Notícias');
  const { me } = useAdminAuth();
  const canWrite = can(me, 'news:write');
  const toast = useToast();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<News | 'new' | null>(null);
  const [removing, setRemoving] = useState<News | null>(null);
  const dq = useDebounced(q);
  const list = useQuery({ queryKey: ['admin', 'news', dq, status, page], queryFn: () => api.get<Paged<News>>(`/admin/news${qs({ q: dq, status, page })}`) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin'] });
  const err = (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Erro na operação');
  const publish = useMutation({ mutationFn: (n: News) => api.post(`/admin/news/${n.id}/publish`), onSuccess: () => { toast.success('Publicação publicada'); refresh(); }, onError: err });
  const unpublish = useMutation({ mutationFn: (n: News) => api.post(`/admin/news/${n.id}/unpublish`), onSuccess: () => { toast.success('Publicação despublicada'); refresh(); }, onError: err });
  const remove = useMutation({ mutationFn: (n: News) => api.delete(`/admin/news/${n.id}`), onSuccess: () => { toast.success('Publicação excluída'); setRemoving(null); refresh(); }, onError: (e) => { err(e); setRemoving(null); } });

  return (
    <div>
      <PageHeader title="Notícias e comunicados" action={canWrite && <Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> Nova publicação</Button>} />
      <Card>
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-3">
          <div className="relative sm:col-span-2"><Search className="absolute top-3 left-3 h-4 w-4 text-slate-400" /><Input className="pl-9" placeholder="Buscar por título" aria-label="Buscar publicações" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
          <Select aria-label="Situação" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">Todas as situações</option>{Object.entries(NEWS_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        </div>
        {list.isLoading ? <Spinner /> : list.isError ? <ErrorState message="Erro ao carregar." onRetry={() => list.refetch()} /> : !list.data?.items.length ? <EmptyState title="Nenhuma publicação" /> : (
          <>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr><th className="px-4 py-3">Título</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3" /></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {list.data.items.map((n) => (
                  <tr key={n.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{n.title}</td><td className="px-4 py-3">{n.category.name}</td><td className="px-4 py-3 whitespace-nowrap">{formatDateTime(n.publishedAt)}</td>
                    <td className="px-4 py-3"><Badge tone={n.status === 'PUBLISHED' ? 'green' : n.status === 'SCHEDULED' ? 'blue' : n.status === 'DRAFT' ? 'gray' : 'amber'}>{NEWS_STATUS_LABEL[n.status]}</Badge></td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-1">{canWrite && <>
                      {n.status === 'PUBLISHED' || n.status === 'SCHEDULED'
                        ? <Button variant="ghost" size="sm" onClick={() => unpublish.mutate(n)} aria-label="Despublicar" title="Despublicar"><EyeOff className="h-4 w-4" /></Button>
                        : <Button variant="ghost" size="sm" onClick={() => publish.mutate(n)} aria-label="Publicar agora" title="Publicar agora">{n.status === 'DRAFT' ? <Send className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>}
                      <Button variant="ghost" size="sm" onClick={() => setEditing(n)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => setRemoving(n)} aria-label="Excluir"><Trash2 className="h-4 w-4 text-red-600" /></Button></>}</div></td>
                  </tr>
                ))}
              </tbody></table></div>
            <Pagination page={list.data.page} totalPages={list.data.totalPages} total={list.data.total} onChange={setPage} />
          </>
        )}
      </Card>
      {editing && <NewsForm item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog open={!!removing} danger title="Excluir publicação" confirmLabel="Excluir" loading={remove.isPending}
        message={<>Excluir <strong>{removing?.title}</strong>? Esta ação não pode ser desfeita.</>} onConfirm={() => removing && remove.mutate(removing)} onClose={() => setRemoving(null)} />
    </div>
  );
}

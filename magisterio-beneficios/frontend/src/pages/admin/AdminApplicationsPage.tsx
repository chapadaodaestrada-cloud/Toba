import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Paperclip, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { StatusBadge } from '../../components/common';
import { EmptyState, ErrorState, Modal, Pagination, Spinner, useToast } from '../../components/feedback';
import { Badge, Button, Card, CardHeader, Field, Input, PageHeader, Select, Textarea } from '../../components/ui';
import { useDebounced, useDocumentTitle } from '../../hooks/common';
import { can, useAdminAuth } from '../../hooks/useAuth';
import { ApiError, api, qs } from '../../services/api';
import type { Application, ApplicationRow, ApplicationStatus, Benefit, HistoryEntry, Paged } from '../../types';
import { STATUS_LABEL, formatDate, formatDateTime, formatPhone } from '../../utils/format';

const TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  PENDENTE: ['EM_ANALISE', 'AGUARDANDO_DOCUMENTACAO', 'APROVADA', 'RECUSADA'],
  EM_ANALISE: ['AGUARDANDO_DOCUMENTACAO', 'APROVADA', 'RECUSADA'],
  AGUARDANDO_DOCUMENTACAO: ['EM_ANALISE', 'RECUSADA'],
  APROVADA: ['CONCLUIDA'],
  RECUSADA: [],
  CONCLUIDA: [],
};

export default function AdminApplicationsPage() {
  useDocumentTitle('Solicitações');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [benefitId, setBenefitId] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const benefits = useQuery({ queryKey: ['admin', 'benefits', 'options'], queryFn: () => api.get<Paged<Benefit>>('/admin/benefits?pageSize=100') });
  const list = useQuery({ queryKey: ['admin', 'applications', dq, status, benefitId, page], queryFn: () => api.get<Paged<ApplicationRow>>(`/admin/applications${qs({ q: dq, status, benefitId, page })}`) });
  return (
    <div>
      <PageHeader title="Solicitações" description="Acompanhe e analise as solicitações de benefícios." />
      <Card>
        <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-3">
          <div className="relative"><Search className="absolute top-3 left-3 h-4 w-4 text-slate-400" /><Input className="pl-9" placeholder="Usuário ou protocolo" aria-label="Buscar solicitações" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></div>
          <Select aria-label="Benefício" value={benefitId} onChange={(e) => { setBenefitId(e.target.value); setPage(1); }}><option value="">Todos os benefícios</option>{benefits.data?.items.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>
          <Select aria-label="Situação" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">Todas as situações</option>{(Object.keys(STATUS_LABEL) as ApplicationStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</Select>
        </div>
        {list.isLoading ? <Spinner /> : list.isError ? <ErrorState message="Erro ao carregar." onRetry={() => list.refetch()} /> : !list.data?.items.length ? <EmptyState title="Nenhuma solicitação encontrada" /> : (
          <>
            <div className="overflow-x-auto"><table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase"><tr><th className="px-4 py-3">Protocolo</th><th className="px-4 py-3">Usuário</th><th className="px-4 py-3">Benefício</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3" /></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {list.data.items.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs">{a.protocol}</td><td className="px-4 py-3">{a.user?.name}</td><td className="px-4 py-3">{a.benefit.name}</td>
                    <td className="px-4 py-3">{formatDate(a.createdAt)}</td><td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                    <td className="px-4 py-3 text-right"><Link className="text-navy-700 underline" to={`/admin/solicitacoes/${a.id}`}>Analisar</Link></td>
                  </tr>
                ))}
              </tbody></table></div>
            <Pagination page={list.data.page} totalPages={list.data.totalPages} total={list.data.total} onChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}

type AdminHistory = HistoryEntry;

export function AdminApplicationDetailPage() {
  const { id } = useParams();
  const { me } = useAdminAuth();
  const canReview = can(me, 'applications:review');
  const toast = useToast();
  const qc = useQueryClient();
  const [target, setTarget] = useState<ApplicationStatus | null>(null);
  const [note, setNote] = useState('');
  const [obs, setObs] = useState('');
  const [obsVisible, setObsVisible] = useState(true);
  const q = useQuery({ queryKey: ['admin', 'application', id], queryFn: () => api.get<Application>(`/admin/applications/${id}`) });
  useDocumentTitle(q.data?.protocol ?? 'Solicitação');
  const err = (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Erro na operação');
  const done = () => qc.invalidateQueries({ queryKey: ['admin'] });
  const change = useMutation({
    mutationFn: () => api.post(`/admin/applications/${id}/status`, { status: target, note: note || undefined }),
    onSuccess: () => { toast.success('Situação atualizada'); setTarget(null); setNote(''); done(); }, onError: err,
  });
  const addNote = useMutation({
    mutationFn: () => api.post(`/admin/applications/${id}/notes`, { note: obs, visibleToUser: obsVisible }),
    onSuccess: () => { toast.success('Observação registrada'); setObs(''); done(); }, onError: err,
  });
  if (q.isLoading) return <Spinner />;
  if (q.isError || !q.data) return <ErrorState message="Solicitação não encontrada." />;
  const a = q.data;
  const next = TRANSITIONS[a.status];
  const needsNote = target === 'RECUSADA' || target === 'AGUARDANDO_DOCUMENTACAO';
  const history = a.history as AdminHistory[];

  const actionLabel = (s: ApplicationStatus) => ({ APROVADA: 'Aprovar', RECUSADA: 'Recusar', AGUARDANDO_DOCUMENTACAO: 'Solicitar documentação', EM_ANALISE: 'Colocar em análise', CONCLUIDA: 'Concluir', PENDENTE: 'Pendente' }[s]);

  return (
    <div className="space-y-6">
      <Link to="/admin/solicitacoes" className="inline-flex items-center gap-1 text-sm text-navy-700"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
      <PageHeader title={`Solicitação ${a.protocol}`} description={`${a.benefit.name} · aberta em ${formatDate(a.createdAt)}`} action={<StatusBadge status={a.status} />} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {canReview && (
            <Card>
              <CardHeader title="Ações" />
              <div className="p-5">
                {next.length === 0 ? <p className="text-sm text-slate-500">Esta solicitação está em situação final e não pode mais ser alterada.</p> : (
                  <div className="flex flex-wrap gap-2">
                    {next.map((s) => <Button key={s} variant={s === 'APROVADA' ? 'success' : s === 'RECUSADA' ? 'danger' : 'secondary'} size="sm" onClick={() => { setTarget(s); setNote(''); }}>{actionLabel(s)}</Button>)}
                  </div>
                )}
                <div className="mt-5 border-t border-slate-100 pt-4">
                  <Field label="Adicionar observação"><Textarea className="min-h-20" value={obs} onChange={(e) => setObs(e.target.value)} /></Field>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={obsVisible} onChange={(e) => setObsVisible(e.target.checked)} /> Visível ao usuário</label>
                    <Button size="sm" disabled={obs.trim().length < 2} loading={addNote.isPending} onClick={() => addNote.mutate()}>Registrar observação</Button>
                  </div>
                </div>
              </div>
            </Card>
          )}
          <Card>
            <CardHeader title="Histórico de alterações" />
            <ol className="divide-y divide-slate-100">
              {history.map((h) => (
                <li key={h.id} className="px-5 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      {h.fromStatus && h.fromStatus !== h.toStatus ? <><StatusBadge status={h.fromStatus} /> → <StatusBadge status={h.toStatus} /></> : <><Badge tone="gray">Observação</Badge> <StatusBadge status={h.toStatus} /></>}
                      {!h.visibleToUser && <Badge tone="amber">Interna</Badge>}
                    </span>
                    <span className="text-xs text-slate-500">{formatDateTime(h.createdAt)} · {h.admin?.name ?? h.user?.name ?? 'Sistema'}</span>
                  </div>
                  {h.note && <p className="mt-2 text-slate-700">{h.note}</p>}
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Solicitante" />
            <dl className="space-y-2 p-5 text-sm">
              <div><dt className="text-xs text-slate-500">Nome</dt><dd>{a.user?.name}</dd></div>
              <div><dt className="text-xs text-slate-500">E-mail</dt><dd>{a.user?.email}</dd></div>
              <div><dt className="text-xs text-slate-500">Telefone</dt><dd>{a.user && formatPhone(a.user.phone)}</dd></div>
              <div><dt className="text-xs text-slate-500">Instituição</dt><dd>{a.user?.institution || '—'}</dd></div>
            </dl>
          </Card>
          <Card>
            <CardHeader title="Documentos" />
            <div className="space-y-2 p-5 text-sm">
              {a.documents.length === 0 && <p className="text-slate-500">Nenhum documento enviado.</p>}
              {a.documents.map((d) => <a key={d.id} href={`/api/admin/applications/${a.id}/documents/${d.id}`} className="flex items-center gap-2 text-navy-700 hover:underline"><Paperclip className="h-4 w-4" />{d.originalName}</a>)}
              <p className="pt-2 text-xs text-slate-500">O acesso a cada documento é registrado no histórico de atividades.</p>
            </div>
          </Card>
          {a.message && <Card><CardHeader title="Mensagem do solicitante" /><p className="p-5 text-sm text-slate-700">{a.message}</p></Card>}
        </div>
      </div>

      <Modal open={!!target} onClose={() => setTarget(null)} title={target ? actionLabel(target) : ''}>
        <p className="mb-3 text-sm text-slate-600">A situação será alterada de <strong>{STATUS_LABEL[a.status]}</strong> para <strong>{target && STATUS_LABEL[target]}</strong>. A ação ficará registrada com seu nome e horário.</p>
        <Field label={target === 'RECUSADA' ? 'Motivo da recusa' : target === 'AGUARDANDO_DOCUMENTACAO' ? 'Documentos necessários' : 'Observação (opcional)'} required={needsNote}>
          <Textarea className="min-h-24" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setTarget(null)}>Cancelar</Button>
          <Button loading={change.isPending} disabled={needsNote && !note.trim()} onClick={() => change.mutate()}>Confirmar</Button>
        </div>
      </Modal>
    </div>
  );
}

import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, FileText, Search, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CoverImage } from '../../components/common';
import { EmptyState, ErrorState, Pagination, Spinner, useToast } from '../../components/feedback';
import { BenefitCard } from '../../components/public';
import { Badge, Button, Card, Input, Select, Textarea } from '../../components/ui';
import { useDebounced, useDocumentTitle } from '../../hooks/common';
import { useUserAuth } from '../../hooks/useAuth';
import { ApiError, api, qs } from '../../services/api';
import type { Benefit, Category, Paged } from '../../types';
import { AVAILABILITY_LABEL, formatDate } from '../../utils/format';

export function BenefitsPage() {
  useDocumentTitle('Benefícios');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const cats = useQuery({ queryKey: ['public', 'benefit-cats'], queryFn: () => api.get<Category[]>('/public/benefits/categories') });
  const list = useQuery({
    queryKey: ['public', 'benefits', dq, category, page],
    queryFn: () => api.get<Paged<Benefit>>(`/public/benefits${qs({ q: dq, category, page })}`),
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold text-navy-900">Benefícios</h1>
      <p className="mt-2 max-w-2xl text-slate-600">Consulte os benefícios disponíveis, seus requisitos e a documentação necessária.</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="relative sm:col-span-2">
          <Search className="absolute top-3 left-3 h-4 w-4 text-slate-400" />
          <Input className="pl-9" placeholder="Buscar benefício" aria-label="Buscar benefício" value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
        <Select aria-label="Categoria" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
          <option value="">Todas as categorias</option>
          {cats.data?.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
        </Select>
      </div>

      <div className="mt-8">
        {list.isLoading && <Spinner />}
        {list.isError && <ErrorState message="Não foi possível carregar os benefícios." onRetry={() => list.refetch()} />}
        {list.data && !list.data.items.length && <EmptyState title="Nenhum benefício encontrado" description="Ajuste a busca ou a categoria." />}
        {list.data && list.data.items.length > 0 && (
          <>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{list.data.items.map((b) => <BenefitCard key={b.id} b={b} />)}</div>
            <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
              <Pagination page={list.data.page} totalPages={list.data.totalPages} total={list.data.total} onChange={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function BenefitDetailPage() {
  const { slug } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { me } = useUserAuth();
  const [message, setMessage] = useState('');
  const q = useQuery({ queryKey: ['public', 'benefit', slug], queryFn: () => api.get<Benefit>(`/public/benefits/${slug}`), retry: false });
  useDocumentTitle(q.data?.name ?? 'Benefício');

  const apply = useMutation({
    mutationFn: () => api.post<{ id: string; protocol: string }>('/me/applications', { benefitId: q.data!.id, message: message || undefined }),
    onSuccess: (app) => {
      toast.success(`Solicitação registrada. Protocolo ${app.protocol}`);
      nav(`/minha-conta/solicitacoes/${app.id}`);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Erro ao registrar solicitação'),
  });

  if (q.isLoading) return <Spinner />;
  if (q.isError || !q.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState title="Benefício não encontrado" action={<Link to="/beneficios"><Button variant="secondary">Voltar ao catálogo</Button></Link>} />
      </div>
    );
  }
  const b = q.data;
  const open = b.availability === 'ABERTO';

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link to="/beneficios" className="mb-4 inline-flex items-center gap-1 text-sm text-navy-700"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CoverImage src={b.imageUrl} alt={b.name} className="h-56 w-full rounded-lg" />
          <div>
            <div className="mb-2 flex gap-2"><Badge tone="navy">{b.category.name}</Badge><Badge tone={open ? 'green' : 'amber'}>{AVAILABILITY_LABEL[b.availability]}</Badge></div>
            <h1 className="text-3xl font-semibold text-navy-900">{b.name}</h1>
            <p className="mt-3 whitespace-pre-line text-slate-700">{b.description}</p>
          </div>
          <Card className="p-5">
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-navy-900"><CheckCircle2 className="h-5 w-5 text-brand-600" /> Requisitos</h2>
            {b.requirements.length ? (
              <ul className="list-disc space-y-1 pl-6 text-sm text-slate-700">{b.requirements.map((r) => <li key={r.id}>{r.text}</li>)}</ul>
            ) : <p className="text-sm text-slate-500">Nenhum requisito específico informado.</p>}
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-5">
              <h2 className="mb-2 flex items-center gap-2 font-semibold text-navy-900"><Users className="h-5 w-5 text-navy-700" /> Público elegível</h2>
              <p className="text-sm text-slate-700">{b.targetAudience}</p>
            </Card>
            <Card className="p-5">
              <h2 className="mb-2 flex items-center gap-2 font-semibold text-navy-900"><FileText className="h-5 w-5 text-navy-700" /> Documentação necessária</h2>
              <p className="text-sm text-slate-700">{b.requiredDocuments}</p>
            </Card>
          </div>
        </div>

        <aside>
          <Card className="sticky top-24 space-y-4 p-5">
            <h2 className="font-semibold text-navy-900">Solicitar benefício</h2>
            <dl className="space-y-1 text-sm text-slate-600">
              <div className="flex justify-between"><dt>Início</dt><dd>{formatDate(b.startDate)}</dd></div>
              <div className="flex justify-between"><dt>Encerramento</dt><dd>{formatDate(b.endDate)}</dd></div>
            </dl>
            {!open ? (
              <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">Este benefício não está aberto para solicitações no momento.</p>
            ) : !me ? (
              <>
                <p className="text-sm text-slate-600">Entre ou cadastre-se para iniciar a solicitação.</p>
                <Link to="/login" state={{ from: `/beneficios/${b.slug}` }}><Button className="w-full">Entrar para solicitar</Button></Link>
                <Link to="/cadastro"><Button variant="secondary" className="w-full">Criar conta</Button></Link>
              </>
            ) : (
              <>
                <Textarea placeholder="Observações (opcional)" aria-label="Observações" maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />
                <Button className="w-full" loading={apply.isPending} onClick={() => apply.mutate()}>Iniciar solicitação</Button>
                <p className="text-xs text-slate-500">Após registrar, você poderá anexar documentos na página da solicitação.</p>
              </>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}

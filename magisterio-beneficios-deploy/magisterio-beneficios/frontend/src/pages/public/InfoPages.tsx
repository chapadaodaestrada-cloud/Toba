import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ClipboardList, Eye, FileSearch, GraduationCap, HelpCircle, Mail, MapPin, Phone, Scale, Target } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { CoverImage, RichText } from '../../components/common';
import { EmptyState, ErrorState, Pagination, Spinner } from '../../components/feedback';
import { Accordion, NewsCard, SectionTitle } from '../../components/public';
import { Badge, Button, Card } from '../../components/ui';
import { useDocumentTitle, useSettings } from '../../hooks/common';
import { api, qs } from '../../services/api';
import type { Category, News, Paged } from '../../types';
import { formatDate } from '../../utils/format';
import { FAQ } from './content';

export function ServicesPage() {
  useDocumentTitle('Serviços');
  const blocks = [
    { icon: FileSearch, title: 'Consulta de informações', text: 'Pesquise benefícios, requisitos, público elegível e documentação necessária.', to: '/beneficios', cta: 'Consultar benefícios' },
    { icon: GraduationCap, title: 'Orientações para professores', text: 'Acompanhe comunicados e orientações publicados pela equipe de atendimento.', to: '/noticias', cta: 'Ver orientações' },
    { icon: ClipboardList, title: 'Solicitações', text: 'Crie solicitações, anexe documentos e responda a pedidos de complementação.', to: '/minha-conta/solicitacoes', cta: 'Minhas solicitações' },
    { icon: Eye, title: 'Acompanhamento de atendimentos', text: 'Veja a situação atual e o histórico completo de cada solicitação.', to: '/minha-conta/historico', cta: 'Ver histórico' },
  ];
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold text-navy-900">Serviços</h1>
      <p className="mt-2 max-w-2xl text-slate-600">Tudo o que você pode fazer na plataforma. Serviços de conta exigem login.</p>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {blocks.map(({ icon: Icon, title, text, to, cta }) => (
          <Card key={title} className="flex flex-col p-6">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-navy-50 text-navy-700"><Icon className="h-5 w-5" /></span>
            <h2 className="font-semibold text-navy-900">{title}</h2>
            <p className="mt-1 flex-1 text-sm text-slate-600">{text}</p>
            <Link to={to} className="mt-4"><Button variant="secondary" size="sm">{cta}</Button></Link>
          </Card>
        ))}
      </div>
      <div className="mt-14">
        <SectionTitle eyebrow="Perguntas frequentes" title="Dúvidas comuns" />
        <Accordion items={FAQ} />
        <p className="mt-4 flex items-center gap-2 text-sm text-slate-500"><HelpCircle className="h-4 w-4" /> Não encontrou? Fale com o atendimento na página <Link className="text-navy-700 underline" to="/institucional">Institucional</Link>.</p>
      </div>
    </div>
  );
}

export function AboutPage() {
  useDocumentTitle('Institucional');
  const { data: s } = useSettings();
  const pillars = [
    { icon: Target, title: 'Missão', text: 'Aproximar profissionais da educação das informações e dos canais necessários para solicitar benefícios, com clareza e segurança.' },
    { icon: Eye, title: 'Visão', text: 'Ser uma referência em transparência e organização no atendimento a profissionais da educação.' },
    { icon: Scale, title: 'Valores', text: 'Transparência, respeito aos dados pessoais, imparcialidade na análise e compromisso com o atendimento.' },
  ];
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold text-navy-900">Sobre o {s?.platformName ?? 'Magistério Benefícios'}</h1>
      <p className="mt-3 max-w-3xl text-slate-700">{s?.about}</p>
      <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Importante:</strong> o Magistério Benefícios é uma plataforma institucional independente. Não somos um órgão governamental nem uma entidade pública oficial.
      </div>

      <section className="mt-10">
        <SectionTitle title="Objetivos da plataforma" />
        <ul className="list-disc space-y-1 pl-6 text-slate-700">
          <li>Centralizar informações sobre benefícios para profissionais da educação.</li>
          <li>Permitir solicitações e envio de documentos de forma digital.</li>
          <li>Oferecer acompanhamento transparente de cada atendimento.</li>
        </ul>
      </section>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {pillars.map(({ icon: Icon, title, text }) => (
          <Card key={title} className="p-6">
            <Icon className="mb-3 h-6 w-6 text-brand-600" />
            <h2 className="font-semibold text-navy-900">{title}</h2>
            <p className="mt-2 text-sm text-slate-600">{text}</p>
          </Card>
        ))}
      </div>

      <section className="mt-12">
        <SectionTitle title="Canais de contato" />
        <Card className="max-w-xl space-y-3 p-5 text-sm">
          {s?.contactEmail && <div className="flex gap-3"><Mail className="h-5 w-5 text-navy-700" />{s.contactEmail}</div>}
          {s?.contactPhone && <div className="flex gap-3"><Phone className="h-5 w-5 text-navy-700" />{s.contactPhone}</div>}
          {s?.address && <div className="flex gap-3"><MapPin className="h-5 w-5 shrink-0 text-navy-700" />{s.address}</div>}
        </Card>
      </section>
    </div>
  );
}

export function NewsListPage() {
  useDocumentTitle('Notícias');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const cats = useQuery({ queryKey: ['public', 'news-cats'], queryFn: () => api.get<Category[]>('/public/news/categories') });
  const list = useQuery({ queryKey: ['public', 'news', category, page], queryFn: () => api.get<Paged<News>>(`/public/news${qs({ category, page })}`) });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold text-navy-900">Notícias e comunicados</h1>
      <div className="mt-5 flex flex-wrap gap-2">
        {[{ id: 0, name: 'Todas', slug: '' }, ...(cats.data ?? [])].map((c) => (
          <button key={c.id} onClick={() => { setCategory(c.slug); setPage(1); }}
            className={clsx('rounded-full border px-4 py-1.5 text-sm', category === c.slug ? 'border-navy-700 bg-navy-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50')}>
            {c.name}
          </button>
        ))}
      </div>
      <div className="mt-8">
        {list.isLoading && <Spinner />}
        {list.isError && <ErrorState message="Não foi possível carregar as notícias." onRetry={() => list.refetch()} />}
        {list.data && !list.data.items.length && <EmptyState title="Nenhuma publicação encontrada" />}
        {list.data && list.data.items.length > 0 && (
          <>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{list.data.items.map((n) => <NewsCard key={n.id} n={n} />)}</div>
            <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
              <Pagination page={list.data.page} totalPages={list.data.totalPages} total={list.data.total} onChange={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function NewsDetailPage() {
  const { slug } = useParams();
  const q = useQuery({ queryKey: ['public', 'news-item', slug], queryFn: () => api.get<News>(`/public/news/${slug}`), retry: false });
  useDocumentTitle(q.data?.title ?? 'Notícia');
  if (q.isLoading) return <Spinner />;
  if (q.isError || !q.data) {
    return <div className="mx-auto max-w-3xl px-4 py-16"><EmptyState title="Publicação não encontrada" action={<Link to="/noticias"><Button variant="secondary">Ver notícias</Button></Link>} /></div>;
  }
  const n = q.data;
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <Link to="/noticias" className="mb-4 inline-flex items-center gap-1 text-sm text-navy-700"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
      <div className="mb-3 flex items-center gap-3 text-sm text-slate-500"><Badge tone="blue">{n.category.name}</Badge><time>{formatDate(n.publishedAt)}</time></div>
      <h1 className="text-3xl font-semibold text-navy-900">{n.title}</h1>
      <p className="mt-3 text-lg text-slate-600">{n.excerpt}</p>
      {n.imageUrl && <CoverImage src={n.imageUrl} alt={n.title} className="my-6 h-64 w-full rounded-lg" />}
      <div className="mt-6"><RichText text={n.content} /></div>
    </article>
  );
}

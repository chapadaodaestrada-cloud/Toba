import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, FileSearch, GraduationCap, HeartHandshake, LifeBuoy, Lock, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Spinner } from '../../components/feedback';
import { Accordion, BenefitCard, NewsCard, SectionTitle } from '../../components/public';
import { Button, Card } from '../../components/ui';
import { useDocumentTitle, useSettings } from '../../hooks/common';
import { api } from '../../services/api';
import type { Benefit, News, Paged } from '../../types';
import { FAQ, STEPS } from './content';

const services = [
  { icon: FileSearch, title: 'Consulta de informações', text: 'Requisitos, documentação e público elegível de cada benefício.' },
  { icon: GraduationCap, title: 'Orientações para professores', text: 'Comunicados e materiais para tirar dúvidas sobre os benefícios.' },
  { icon: ClipboardCheck, title: 'Solicitações online', text: 'Envie o pedido e os documentos sem sair de casa.' },
  { icon: LifeBuoy, title: 'Acompanhamento', text: 'Acompanhe a situação e o histórico de cada atendimento.' },
];

export default function HomePage() {
  useDocumentTitle('Início');
  const { data: s } = useSettings();
  const benefits = useQuery({ queryKey: ['public', 'benefits', 'home'], queryFn: () => api.get<Paged<Benefit>>('/public/benefits?pageSize=3') });
  const news = useQuery({ queryKey: ['public', 'news', 'home'], queryFn: () => api.get<Paged<News>>('/public/news?pageSize=3') });

  return (
    <>
      <section className="bg-navy-800 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-5 md:py-24">
          <div className="md:col-span-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-navy-500 px-3 py-1 text-xs text-navy-100">
              <ShieldCheck className="h-3.5 w-3.5" /> Plataforma institucional independente
            </span>
            <h1 className="mt-5 text-3xl leading-tight font-semibold md:text-5xl">
              Benefícios para quem dedica a vida a ensinar.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-navy-100">
              Consulte benefícios, entenda os requisitos e acompanhe suas solicitações em um só lugar, com transparência e segurança dos seus dados.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/beneficios"><Button variant="success" className="px-6 py-3">Conhecer os benefícios</Button></Link>
              <Link to="/cadastro"><Button variant="secondary" className="px-6 py-3">Criar minha conta</Button></Link>
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="rounded-lg border border-navy-600 bg-navy-700 p-6 text-white">
              <h2 className="mb-4 text-sm font-semibold tracking-wide text-navy-100 uppercase">Compromissos da plataforma</h2>
              <ul className="space-y-4 text-sm">
                <li className="flex gap-3"><Lock className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" /> Dados pessoais tratados conforme a LGPD.</li>
                <li className="flex gap-3"><HeartHandshake className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" /> Informações claras sobre requisitos e documentação.</li>
                <li className="flex gap-3"><ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" /> Histórico transparente de cada solicitação.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <SectionTitle eyebrow="Benefícios em destaque" title="Conheça os benefícios disponíveis" text="Veja requisitos, público elegível e documentação antes de solicitar." />
        {benefits.isLoading ? <Spinner /> : (
          <div className="grid gap-5 md:grid-cols-3">
            {benefits.data?.items.map((b) => <BenefitCard key={b.id} b={b} />)}
          </div>
        )}
        {!benefits.isLoading && !benefits.data?.items.length && <p className="text-sm text-slate-500">Nenhum benefício publicado no momento.</p>}
        <div className="mt-8"><Link to="/beneficios"><Button variant="secondary">Ver todos os benefícios</Button></Link></div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <SectionTitle eyebrow="Serviços" title="O que você encontra na plataforma" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {services.map(({ icon: Icon, title, text }) => (
              <div key={title}>
                <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-navy-50 text-navy-700"><Icon className="h-5 w-5" /></span>
                <h3 className="font-semibold text-navy-900">{title}</h3>
                <p className="mt-1 text-sm text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <SectionTitle eyebrow="Como funciona" title="Em quatro passos" />
        <ol className="grid gap-5 md:grid-cols-4">
          {STEPS.map((st, i) => (
            <li key={st.title} className="rounded-lg border border-slate-200 bg-white p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white">{i + 1}</span>
              <h3 className="mt-3 font-semibold text-navy-900">{st.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{st.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <SectionTitle eyebrow="Notícias e comunicados" title="Fique por dentro" />
          {news.isLoading ? <Spinner /> : (
            <div className="grid gap-5 md:grid-cols-3">{news.data?.items.map((n) => <NewsCard key={n.id} n={n} />)}</div>
          )}
          {!news.isLoading && !news.data?.items.length && <p className="text-sm text-slate-500">Nenhuma publicação no momento.</p>}
          <div className="mt-8"><Link to="/noticias"><Button variant="secondary">Ver todas as notícias</Button></Link></div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-5">
        <div className="md:col-span-3">
          <SectionTitle eyebrow="Perguntas frequentes" title="Dúvidas comuns" />
          <Accordion items={FAQ} />
        </div>
        <div className="md:col-span-2">
          <SectionTitle eyebrow="Atendimento" title="Canais de contato" />
          <Card className="space-y-4 p-5 text-sm">
            {s?.contactEmail && <div className="flex gap-3"><Mail className="h-5 w-5 text-navy-700" /><span>{s.contactEmail}</span></div>}
            {s?.contactPhone && <div className="flex gap-3"><Phone className="h-5 w-5 text-navy-700" /><span>{s.contactPhone}</span></div>}
            {s?.address && <div className="flex gap-3"><MapPin className="h-5 w-5 shrink-0 text-navy-700" /><span>{s.address}</span></div>}
            <p className="border-t border-slate-100 pt-4 text-slate-500">
              Já é cadastrado? Acompanhe o atendimento em <Link className="font-medium text-navy-700 underline" to="/minha-conta/solicitacoes">Minha conta</Link>.
            </p>
          </Card>
        </div>
      </section>
    </>
  );
}

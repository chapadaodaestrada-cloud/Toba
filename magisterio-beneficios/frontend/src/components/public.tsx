import { ArrowRight, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import type { Benefit, News } from '../types';
import { AVAILABILITY_LABEL, formatDate } from '../utils/format';
import { CoverImage } from './common';
import { Badge, Card } from './ui';

export function SectionTitle({ eyebrow, title, text }: { eyebrow?: string; title: string; text?: string }) {
  return (
    <div className="mb-8 max-w-2xl">
      {eyebrow && <div className="mb-2 text-xs font-semibold tracking-widest text-brand-600 uppercase">{eyebrow}</div>}
      <h2 className="text-2xl font-semibold text-navy-900 md:text-3xl">{title}</h2>
      {text && <p className="mt-2 text-slate-600">{text}</p>}
    </div>
  );
}

export function BenefitCard({ b }: { b: Benefit }) {
  const tone = b.availability === 'ABERTO' ? 'green' : b.availability === 'EM_BREVE' ? 'amber' : 'gray';
  return (
    <Card className="flex flex-col overflow-hidden transition-colors hover:border-navy-200">
      <CoverImage src={b.imageUrl} alt={b.name} className="h-36 w-full" />
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Badge tone="navy">{b.category.name}</Badge>
          <Badge tone={tone}>{AVAILABILITY_LABEL[b.availability]}</Badge>
        </div>
        <h3 className="font-semibold text-navy-900">{b.name}</h3>
        <p className="mt-2 flex-1 text-sm text-slate-600">{b.summary}</p>
        <Link to={`/beneficios/${b.slug}`} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-navy-700 hover:text-navy-900">
          Consultar detalhes <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </Card>
  );
}

export function NewsCard({ n }: { n: News }) {
  return (
    <Card className="flex flex-col overflow-hidden transition-colors hover:border-navy-200">
      <CoverImage src={n.imageUrl} alt={n.title} className="h-40 w-full" />
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
          <Badge tone="blue">{n.category.name}</Badge>
          <time>{formatDate(n.publishedAt)}</time>
        </div>
        <h3 className="font-semibold text-navy-900">{n.title}</h3>
        <p className="mt-2 flex-1 text-sm text-slate-600">{n.excerpt}</p>
        <Link to={`/noticias/${n.slug}`} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-navy-700 hover:text-navy-900">
          Ler publicação <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </Card>
  );
}

export function Accordion({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
      {items.map((it, i) => (
        <div key={it.q}>
          <button
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-navy-900"
            onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
            {it.q}
            <ChevronDown className={clsx('h-4 w-4 shrink-0 transition-transform', open === i && 'rotate-180')} />
          </button>
          {open === i && <p className="px-5 pb-4 text-sm text-slate-600">{it.a}</p>}
        </div>
      ))}
    </div>
  );
}

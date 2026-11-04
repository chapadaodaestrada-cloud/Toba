import { GraduationCap, ImageOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Badge } from './ui';
import type { ApplicationStatus } from '../types';
import { STATUS_LABEL, STATUS_TONE } from '../utils/format';

export const StatusBadge = ({ status }: { status: ApplicationStatus }) => (
  <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
);

export function Logo({ light, to = '/', name = 'Magistério Benefícios', suffix }: {
  light?: boolean; to?: string; name?: string; suffix?: string;
}) {
  return (
    <Link to={to} className="flex items-center gap-2.5">
      <span className={clsx('flex h-9 w-9 items-center justify-center rounded-lg', light ? 'bg-white text-navy-800' : 'bg-navy-800 text-white')}>
        <GraduationCap className="h-5 w-5" />
      </span>
      <span className="leading-tight">
        <span className={clsx('block text-base font-semibold', light ? 'text-white' : 'text-navy-900')}>{name}</span>
        {suffix && <span className={clsx('block text-[11px] tracking-wide uppercase', light ? 'text-navy-200' : 'text-slate-500')}>{suffix}</span>}
      </span>
    </Link>
  );
}

export function CoverImage({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  if (!src) {
    return (
      <div className={clsx('flex items-center justify-center bg-navy-50 text-navy-200', className)} aria-hidden>
        <ImageOff className="h-8 w-8" />
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" className={clsx('object-cover', className)} />;
}

/** Renderiza conteúdo de texto simples sem HTML (seguro contra XSS): "## " vira subtítulo, "- " vira lista. */
export function RichText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="prose-content text-slate-700">
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        if (lines.every((l) => l.startsWith('- '))) {
          return <ul key={i}>{lines.map((l, j) => <li key={j}>{l.slice(2)}</li>)}</ul>;
        }
        if (block.startsWith('## ')) {
          return <h2 key={i}>{block.slice(3)}</h2>;
        }
        return <p key={i}>{block}</p>;
      })}
    </div>
  );
}

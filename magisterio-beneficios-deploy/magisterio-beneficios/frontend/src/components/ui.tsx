import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
const variants: Record<Variant, string> = {
  primary: 'bg-navy-700 text-white hover:bg-navy-800 disabled:bg-navy-200',
  secondary: 'bg-white text-navy-800 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  success: 'bg-brand-600 text-white hover:bg-brand-600/90 disabled:bg-brand-500/50',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  ghost: 'text-navy-700 hover:bg-navy-50 disabled:text-slate-400',
};

export function Button({
  variant = 'primary', loading, size = 'md', className, children, disabled, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; size?: 'sm' | 'md' }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed',
        size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5 text-sm',
        variants[variant], className,
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

const control =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/20 disabled:bg-slate-100';

export function Field({ label, error, hint, children, required }: {
  label: string; error?: string; hint?: string; children: ReactNode; required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}{required && <span className="text-red-600"> *</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span role="alert" className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export const Input = ({ className, invalid, ...p }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) => (
  <input {...p} className={clsx(control, invalid && 'border-red-400', className)} />
);
export const Select = ({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className={clsx(control, className)} />
);
export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} className={clsx(control, 'min-h-28', className)} />
);

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx('rounded-lg border border-slate-200 bg-white', className)}>{children}</div>;
}

export function CardHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
      <h2 className="text-sm font-semibold text-navy-800">{title}</h2>
      {action}
    </div>
  );
}

const tones = {
  gray: 'bg-slate-100 text-slate-700',
  blue: 'bg-blue-50 text-blue-700',
  amber: 'bg-amber-50 text-amber-800',
  green: 'bg-brand-50 text-brand-600',
  red: 'bg-red-50 text-red-700',
  navy: 'bg-navy-100 text-navy-800',
} as const;

export const Badge = ({ tone = 'gray', children }: { tone?: keyof typeof tones; children: ReactNode }) => (
  <span className={clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', tones[tone])}>
    {children}
  </span>
);

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-navy-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, icon, tone = 'navy' }: {
  label: string; value: number | string; icon: ReactNode; tone?: 'navy' | 'green' | 'amber' | 'red';
}) {
  const color = { navy: 'bg-navy-50 text-navy-700', green: 'bg-brand-50 text-brand-600', amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-600' }[tone];
  return (
    <Card className="flex items-center gap-4 p-4">
      <span className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', color)}>{icon}</span>
      <div>
        <div className="text-2xl font-semibold text-navy-900">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </Card>
  );
}

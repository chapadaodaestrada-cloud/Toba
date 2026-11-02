import { zodResolver } from '@hookform/resolvers/zod';
import { GraduationCap, ShieldCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Spinner } from '../../components/feedback';
import { Button, Card, Field, Input, Select } from '../../components/ui';
import { useDocumentTitle } from '../../hooks/common';
import { useAdminAuth, useUserAuth } from '../../hooks/useAuth';
import { forgotSchema, loginSchema, registerSchema, resetSchema } from '../../schemas';
import { ApiError, api } from '../../services/api';
import { STATES } from '../../utils/format';
import type { z } from 'zod';

function Shell({ title, subtitle, children, admin }: { title: string; subtitle?: string; children: ReactNode; admin?: boolean }) {
  return (
    <div className={admin ? 'flex min-h-screen items-center justify-center bg-navy-900 p-4' : 'flex min-h-[calc(100vh-4rem)] items-center justify-center p-4 py-12'}>
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className={`mb-3 flex h-12 w-12 items-center justify-center rounded-xl ${admin ? 'bg-brand-500 text-white' : 'bg-navy-800 text-white'}`}>
            {admin ? <ShieldCheck /> : <GraduationCap />}
          </span>
          <h1 className={`text-2xl font-semibold ${admin ? 'text-white' : 'text-navy-900'}`}>{title}</h1>
          {subtitle && <p className={`mt-1 text-sm ${admin ? 'text-navy-200' : 'text-slate-600'}`}>{subtitle}</p>}
        </div>
        <Card className="p-6">{children}</Card>
      </div>
    </div>
  );
}

const ErrorBox = ({ message }: { message: string | null }) =>
  message ? <div role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{message}</div> : null;

type LoginValues = z.infer<typeof loginSchema>;

function LoginForm({ onSubmit, forgotTo }: { onSubmit: (v: LoginValues) => Promise<void>; forgotTo: string }) {
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });
  return (
    <form className="space-y-4" noValidate onSubmit={handleSubmit(async (v) => {
      setError(null);
      try { await onSubmit(v); } catch (e) { setError(e instanceof ApiError ? e.message : 'Falha ao entrar'); }
    })}>
      <ErrorBox message={error} />
      <Field label="E-mail" error={errors.email?.message}><Input type="email" autoComplete="username" {...register('email')} /></Field>
      <Field label="Senha" error={errors.password?.message}><Input type="password" autoComplete="current-password" {...register('password')} /></Field>
      <Button type="submit" className="w-full" loading={isSubmitting}>Entrar</Button>
      <div className="text-center text-sm"><Link to={forgotTo} className="text-navy-700 underline">Esqueci minha senha</Link></div>
    </form>
  );
}

export function LoginPage() {
  useDocumentTitle('Entrar');
  const { me, loading, login } = useUserAuth();
  const nav = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/minha-conta';
  if (loading) return <Spinner />;
  if (me) return <Navigate to={from} replace />;
  return (
    <Shell title="Entrar na sua conta" subtitle="Acesse benefícios e acompanhe suas solicitações">
      <LoginForm forgotTo="/recuperar-senha" onSubmit={async (v) => { await login(v.email, v.password); nav(from, { replace: true }); }} />
      <p className="mt-5 text-center text-sm text-slate-600">Ainda não tem conta? <Link to="/cadastro" className="font-medium text-navy-700 underline">Cadastre-se</Link></p>
    </Shell>
  );
}

export function AdminLoginPage() {
  useDocumentTitle('Acesso administrativo');
  const { me, loading, login } = useAdminAuth();
  const nav = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/admin/dashboard';
  if (loading) return <Spinner />;
  if (me) return <Navigate to={from} replace />;
  return (
    <Shell admin title="Acesso administrativo" subtitle="Área restrita a administradores autorizados">
      <LoginForm forgotTo="/admin/recuperar-senha" onSubmit={async (v) => { await login(v.email, v.password); nav(from, { replace: true }); }} />
      <p className="mt-5 text-center text-xs text-slate-500">Os acessos são registrados. Tentativas excessivas bloqueiam a conta temporariamente.</p>
    </Shell>
  );
}

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterPage() {
  useDocumentTitle('Cadastro');
  const { refresh } = useUserAuth();
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema), defaultValues: { accept: false },
  });
  const submit = async (v: RegisterValues) => {
    setError(null);
    try {
      const { confirmPassword: _c, accept: _a, ...body } = v;
      await api.post('/auth/register', body);
      await refresh();
      nav('/minha-conta', { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível concluir o cadastro');
    }
  };
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-center text-2xl font-semibold text-navy-900">Criar conta</h1>
      <p className="mt-1 mb-6 text-center text-sm text-slate-600">Cadastre-se para solicitar benefícios e acompanhar atendimentos.</p>
      <Card className="p-6">
        <form noValidate className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit(submit)}>
          <div className="sm:col-span-2"><ErrorBox message={error} /></div>
          <div className="sm:col-span-2"><Field label="Nome completo" required error={errors.name?.message}><Input autoComplete="name" {...register('name')} /></Field></div>
          <Field label="CPF" required error={errors.cpf?.message}><Input inputMode="numeric" placeholder="000.000.000-00" {...register('cpf')} /></Field>
          <Field label="Data de nascimento" error={errors.birthDate?.message}><Input type="date" {...register('birthDate')} /></Field>
          <Field label="E-mail" required error={errors.email?.message}><Input type="email" autoComplete="email" {...register('email')} /></Field>
          <Field label="Telefone" required error={errors.phone?.message}><Input inputMode="tel" placeholder="(00) 00000-0000" {...register('phone')} /></Field>
          <div className="sm:col-span-2 border-t border-slate-100 pt-2 text-sm font-semibold text-navy-800">Dados profissionais</div>
          <Field label="Instituição de ensino"><Input {...register('institution')} /></Field>
          <Field label="Cargo / função"><Input {...register('position')} /></Field>
          <Field label="Cidade"><Input {...register('city')} /></Field>
          <Field label="UF"><Select {...register('state')}><option value="">—</option>{STATES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <div className="sm:col-span-2 border-t border-slate-100 pt-2 text-sm font-semibold text-navy-800">Acesso</div>
          <Field label="Senha" required error={errors.password?.message}><Input type="password" autoComplete="new-password" {...register('password')} /></Field>
          <Field label="Confirmar senha" required error={errors.confirmPassword?.message}><Input type="password" autoComplete="new-password" {...register('confirmPassword')} /></Field>
          <label className="sm:col-span-2 flex items-start gap-2 text-sm text-slate-700">
            <input type="checkbox" className="mt-1" {...register('accept')} />
            <span>Autorizo o tratamento dos meus dados pessoais para as finalidades da plataforma, conforme a LGPD.</span>
          </label>
          {errors.accept && <p role="alert" className="sm:col-span-2 text-xs text-red-600">{errors.accept.message}</p>}
          <div className="sm:col-span-2"><Button type="submit" className="w-full" loading={isSubmitting}>Criar conta</Button></div>
        </form>
      </Card>
      <p className="mt-4 text-center text-sm text-slate-600">Já tem conta? <Link to="/login" className="font-medium text-navy-700 underline">Entrar</Link></p>
    </div>
  );
}

export function ForgotPasswordPage({ admin }: { admin?: boolean }) {
  useDocumentTitle('Recuperar senha');
  const [result, setResult] = useState<{ message: string; devToken?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema) });
  const base = admin ? '/admin' : '';
  return (
    <Shell admin={admin} title="Recuperar senha" subtitle="Informe o e-mail cadastrado">
      {result ? (
        <div className="space-y-3 text-sm text-slate-700">
          <p>{result.message}</p>
          <p className="rounded-md bg-amber-50 p-3 text-amber-800">O envio de e-mails ainda não está configurado neste ambiente (integração SMTP pendente).</p>
          {result.devToken && (
            <Link className="block font-medium text-navy-700 underline" to={`${base}/redefinir-senha?token=${result.devToken}`}>Ambiente de desenvolvimento: redefinir agora</Link>
          )}
        </div>
      ) : (
        <form noValidate className="space-y-4" onSubmit={handleSubmit(async (v) => {
          setError(null);
          try { setResult(await api.post(admin ? '/admin/auth/forgot-password' : '/auth/forgot-password', v)); }
          catch (e) { setError(e instanceof ApiError ? e.message : 'Erro ao solicitar'); }
        })}>
          <ErrorBox message={error} />
          <Field label="E-mail" error={errors.email?.message}><Input type="email" {...register('email')} /></Field>
          <Button type="submit" className="w-full" loading={isSubmitting}>Enviar instruções</Button>
        </form>
      )}
      <p className="mt-4 text-center text-sm"><Link className="text-navy-700 underline" to={admin ? '/admin/login' : '/login'}>Voltar ao login</Link></p>
    </Shell>
  );
}

export function ResetPasswordPage({ admin }: { admin?: boolean }) {
  useDocumentTitle('Redefinir senha');
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) });
  return (
    <Shell admin={admin} title="Definir nova senha">
      <form noValidate className="space-y-4" onSubmit={handleSubmit(async (v) => {
        setError(null);
        try {
          await api.post(admin ? '/admin/auth/reset-password' : '/auth/reset-password', { token, password: v.password });
          nav(admin ? '/admin/login' : '/login', { replace: true });
        } catch (e) { setError(e instanceof ApiError ? e.message : 'Erro ao redefinir'); }
      })}>
        <ErrorBox message={error ?? (token ? null : 'Link inválido: token ausente')} />
        <Field label="Nova senha" error={errors.password?.message}><Input type="password" autoComplete="new-password" {...register('password')} /></Field>
        <Field label="Confirmar senha" error={errors.confirmPassword?.message}><Input type="password" autoComplete="new-password" {...register('confirmPassword')} /></Field>
        <Button type="submit" className="w-full" loading={isSubmitting} disabled={!token}>Redefinir senha</Button>
      </form>
    </Shell>
  );
}

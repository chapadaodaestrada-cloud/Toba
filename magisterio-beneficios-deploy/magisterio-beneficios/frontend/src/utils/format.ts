import type { ApplicationStatus } from '../types';

export const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';

export const formatDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export const maskCpf = (cpf: string) =>
  cpf.length === 11 ? `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}` : cpf;

export const maskCpfPrivate = (cpf: string) => (cpf.length === 11 ? `***.${cpf.slice(3, 6)}.***-**` : cpf);

export const formatPhone = (p: string) =>
  p.length === 11 ? `(${p.slice(0, 2)}) ${p.slice(2, 7)}-${p.slice(7)}` : p.length === 10 ? `(${p.slice(0, 2)}) ${p.slice(2, 6)}-${p.slice(6)}` : p;

export const toDateInput = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');
export const toDateTimeInput = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  PENDENTE: 'Pendente',
  EM_ANALISE: 'Em análise',
  AGUARDANDO_DOCUMENTACAO: 'Aguardando documentação',
  APROVADA: 'Aprovada',
  RECUSADA: 'Recusada',
  CONCLUIDA: 'Concluída',
};

export const STATUS_TONE: Record<ApplicationStatus, 'gray' | 'blue' | 'amber' | 'green' | 'red' | 'navy'> = {
  PENDENTE: 'gray',
  EM_ANALISE: 'blue',
  AGUARDANDO_DOCUMENTACAO: 'amber',
  APROVADA: 'green',
  RECUSADA: 'red',
  CONCLUIDA: 'navy',
};

export const AVAILABILITY_LABEL = {
  ABERTO: 'Aberto para solicitação',
  EM_BREVE: 'Em breve',
  ENCERRADO: 'Encerrado',
  INDISPONIVEL: 'Indisponível',
} as const;

export const NEWS_STATUS_LABEL = {
  DRAFT: 'Rascunho', SCHEDULED: 'Programada', PUBLISHED: 'Publicada', UNPUBLISHED: 'Despublicada',
} as const;

export const BENEFIT_STATUS_LABEL = {
  DRAFT: 'Rascunho', PUBLISHED: 'Publicado', UNPUBLISHED: 'Despublicado',
} as const;

export const STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

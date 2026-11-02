export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type ApplicationStatus =
  | 'PENDENTE' | 'EM_ANALISE' | 'AGUARDANDO_DOCUMENTACAO' | 'APROVADA' | 'RECUSADA' | 'CONCLUIDA';

export interface Category { id: number; name: string; slug: string }

export interface Benefit {
  id: string;
  name: string;
  slug: string;
  summary: string;
  description: string;
  category: Category;
  categoryId: number;
  targetAudience: string;
  requiredDocuments: string;
  imageUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED';
  availability: 'ABERTO' | 'EM_BREVE' | 'ENCERRADO' | 'INDISPONIVEL';
  requirements: { id: number; text: string }[];
  _count?: { applications: number };
}

export interface News {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  imageUrl: string | null;
  category: Category;
  categoryId: number;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'UNPUBLISHED';
  publishedAt: string | null;
  author?: { name: string } | null;
}

export interface Settings {
  platformName: string;
  logoUrl: string | null;
  about: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  instagram: string | null;
  facebook: string | null;
  youtube: string | null;
  maintenanceMode: boolean;
  demoMode?: boolean;
  maxUploadMb?: number;
  notifyNewApplication?: boolean;
  notifyStatusChange?: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  cpf: string;
  email: string;
  phone: string;
  birthDate: string | null;
  institution: string | null;
  position: string | null;
  city: string | null;
  state: string | null;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  _count?: { applications: number };
}

export interface HistoryEntry {
  id: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  note: string | null;
  visibleToUser: boolean;
  createdAt: string;
  admin?: { name: string } | null;
  user?: { name: string } | null;
}

export interface DocumentInfo { id: string; originalName: string; mimeType: string; size: number; createdAt: string }

export interface Application {
  id: string;
  protocol: string;
  status: ApplicationStatus;
  message: string | null;
  createdAt: string;
  updatedAt: string;
  benefit: Benefit;
  user?: UserProfile;
  documents: DocumentInfo[];
  history: HistoryEntry[];
}

export interface ApplicationRow {
  id: string;
  protocol: string;
  status: ApplicationStatus;
  createdAt: string;
  benefit: { id?: string; name: string; slug?: string };
  user?: { id: string; name: string; email: string };
  _count?: { documents: number };
}

export interface AdminSession {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
}

export interface AdminAccount {
  id: string;
  name: string;
  email: string;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  role: { id: number; key: string; name: string };
}

export interface Activity {
  id: string;
  action: string;
  module: string;
  recordId: string | null;
  details: string | null;
  createdAt: string;
  admin: { name: string; email?: string } | null;
}

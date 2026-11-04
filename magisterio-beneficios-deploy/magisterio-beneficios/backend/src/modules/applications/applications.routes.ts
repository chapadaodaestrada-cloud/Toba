import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { asyncHandler, pageParams, paged, parse } from '../../common/http';
import { audit } from '../../common/audit';
import { badRequest, notFound } from '../../common/errors';
import { requireAdmin, requireUser } from '../../middleware/auth';
import {
  addNote, afterUserUpload, assertOwner, changeStatus, createApplication, documentPath, saveDocument,
} from './applications.service';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
const STATUSES = ['PENDENTE', 'EM_ANALISE', 'AGUARDANDO_DOCUMENTACAO', 'APROVADA', 'RECUSADA', 'CONCLUIDA'] as const;

async function maxUploadBytes() {
  const s = await prisma.platformSettings.findUnique({ where: { id: 1 } });
  return (s?.maxUploadMb ?? 5) * 1024 * 1024;
}

// ---------- Usuário ----------
export const userApplicationsRouter = Router();
userApplicationsRouter.use(requireUser);

userApplicationsRouter.get('/', asyncHandler(async (req, res) => {
  const status = String(req.query.status ?? '');
  const items = await prisma.application.findMany({
    where: { userId: req.user!.id, ...(STATUSES.includes(status as 'PENDENTE') ? { status: status as 'PENDENTE' } : {}) },
    include: { benefit: { select: { name: true, slug: true } }, _count: { select: { documents: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(items);
}));

userApplicationsRouter.get('/history/all', asyncHandler(async (req, res) => {
  res.json(await prisma.applicationHistory.findMany({
    where: { application: { userId: req.user!.id }, visibleToUser: true },
    orderBy: { createdAt: 'desc' }, take: 200,
    include: { application: { select: { id: true, protocol: true, benefit: { select: { name: true } } } } },
  }));
}));

userApplicationsRouter.post('/', asyncHandler(async (req, res) => {
  const { benefitId, message } = parse(
    z.object({ benefitId: z.string().uuid(), message: z.string().trim().max(1000).optional() }),
    req.body,
  );
  res.status(201).json(await createApplication(req.user!.id, benefitId, message));
}));

async function ownApplication(id: string, userId: string) {
  const app = await prisma.application.findUnique({
    where: { id },
    include: {
      benefit: { include: { category: true } },
      documents: { orderBy: { createdAt: 'asc' } },
      history: { where: { visibleToUser: true }, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!app) throw notFound('Solicitação não encontrada');
  assertOwner(app, userId);
  return app;
}

userApplicationsRouter.get('/:id', asyncHandler(async (req, res) => {
  res.json(await ownApplication(String(req.params.id), req.user!.id));
}));

userApplicationsRouter.post('/:id/documents', upload.single('file'), asyncHandler(async (req, res) => {
  const app = await ownApplication(String(req.params.id), req.user!.id);
  if (!['PENDENTE', 'EM_ANALISE', 'AGUARDANDO_DOCUMENTACAO'].includes(app.status)) {
    throw badRequest('Não é possível anexar documentos nesta situação');
  }
  if (!req.file) throw badRequest('Selecione um arquivo');
  const doc = await saveDocument(app.id, req.file, await maxUploadBytes());
  await afterUserUpload(app.id, req.user!.id);
  res.status(201).json(doc);
}));

userApplicationsRouter.get('/:id/documents/:docId', asyncHandler(async (req, res) => {
  const app = await ownApplication(String(req.params.id), req.user!.id);
  const doc = app.documents.find((d) => d.id === String(req.params.docId));
  if (!doc) throw notFound('Documento não encontrado');
  res.download(documentPath(doc.storedName), doc.originalName);
}));

// ---------- Administração ----------
export const adminApplicationsRouter = Router();

adminApplicationsRouter.get('/', requireAdmin('applications:read'), asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = pageParams(req.query);
  const q = String(req.query.q ?? '').trim();
  const status = String(req.query.status ?? '');
  const benefitId = String(req.query.benefitId ?? '');
  const where: Prisma.ApplicationWhereInput = {
    ...(STATUSES.includes(status as 'PENDENTE') ? { status: status as 'PENDENTE' } : {}),
    ...(benefitId ? { benefitId } : {}),
    ...(q ? { OR: [
      { protocol: { contains: q, mode: 'insensitive' } },
      { user: { name: { contains: q, mode: 'insensitive' } } },
      { user: { email: { contains: q, mode: 'insensitive' } } },
    ] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.application.findMany({
      where, skip, take, orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, email: true } }, benefit: { select: { id: true, name: true } } },
    }),
    prisma.application.count({ where }),
  ]);
  res.json(paged(items, total, page, pageSize));
}));

adminApplicationsRouter.get('/:id', requireAdmin('applications:read'), asyncHandler(async (req, res) => {
  const app = await prisma.application.findUnique({
    where: { id: String(req.params.id) },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, institution: true, position: true, city: true, state: true } },
      benefit: { include: { category: true } },
      documents: { orderBy: { createdAt: 'asc' } },
      history: { orderBy: { createdAt: 'desc' }, include: { admin: { select: { name: true } }, user: { select: { name: true } } } },
    },
  });
  if (!app) throw notFound('Solicitação não encontrada');
  res.json(app);
}));

adminApplicationsRouter.post('/:id/status', requireAdmin('applications:review'), asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const { status, note } = parse(
    z.object({ status: z.enum(STATUSES), note: z.string().trim().max(1000).optional() }),
    req.body,
  );
  const before = await prisma.application.findUnique({ where: { id } });
  const updated = await changeStatus(id, status, req.admin!.id, note);
  await audit(req, {
    action: 'ALTERAR_SITUACAO', module: 'solicitações', recordId: id,
    details: `${updated.protocol}: ${before?.status} → ${status}`,
  });
  res.json(updated);
}));

adminApplicationsRouter.post('/:id/notes', requireAdmin('applications:review'), asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const { note, visibleToUser } = parse(
    z.object({ note: z.string().trim().min(2, 'Escreva a observação').max(1000), visibleToUser: z.boolean().default(true) }),
    req.body,
  );
  const entry = await addNote(id, req.admin!.id, note, visibleToUser);
  await audit(req, { action: 'OBSERVACAO', module: 'solicitações', recordId: id, details: visibleToUser ? 'Observação visível ao usuário' : 'Observação interna' });
  res.status(201).json(entry);
}));

adminApplicationsRouter.get('/:id/documents/:docId', requireAdmin('applications:read'), asyncHandler(async (req, res) => {
  const doc = await prisma.applicationDocument.findFirst({
    where: { id: String(req.params.docId), applicationId: String(req.params.id) },
  });
  if (!doc) throw notFound('Documento não encontrado');
  await audit(req, { action: 'VISUALIZAR_DOCUMENTO', module: 'solicitações', recordId: String(req.params.id), details: doc.originalName });
  res.download(documentPath(doc.storedName), doc.originalName);
}));

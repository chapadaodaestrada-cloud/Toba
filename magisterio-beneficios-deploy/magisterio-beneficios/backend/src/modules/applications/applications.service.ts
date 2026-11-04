import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ApplicationStatus } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { env } from '../../config/env';
import { badRequest, conflict, forbidden, notFound } from '../../common/errors';
import { availability } from '../benefits/benefits.routes';

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  PENDENTE: 'Pendente',
  EM_ANALISE: 'Em análise',
  AGUARDANDO_DOCUMENTACAO: 'Aguardando documentação',
  APROVADA: 'Aprovada',
  RECUSADA: 'Recusada',
  CONCLUIDA: 'Concluída',
};

/** Fluxo permitido de situações. RECUSADA e CONCLUIDA são estados finais. */
export const TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  PENDENTE: ['EM_ANALISE', 'AGUARDANDO_DOCUMENTACAO', 'APROVADA', 'RECUSADA'],
  EM_ANALISE: ['AGUARDANDO_DOCUMENTACAO', 'APROVADA', 'RECUSADA'],
  AGUARDANDO_DOCUMENTACAO: ['EM_ANALISE', 'RECUSADA'],
  APROVADA: ['CONCLUIDA'],
  RECUSADA: [],
  CONCLUIDA: [],
};

const NOTE_REQUIRED: ApplicationStatus[] = ['RECUSADA', 'AGUARDANDO_DOCUMENTACAO'];

export function validateTransition(from: ApplicationStatus, to: ApplicationStatus, note?: string) {
  if (from === to) throw badRequest('A solicitação já está nesta situação');
  if (!TRANSITIONS[from].includes(to)) {
    throw badRequest(`Não é possível alterar de "${STATUS_LABEL[from]}" para "${STATUS_LABEL[to]}"`);
  }
  if (NOTE_REQUIRED.includes(to) && !note?.trim()) {
    throw badRequest(
      to === 'RECUSADA' ? 'Informe o motivo da recusa' : 'Informe quais documentos complementares são necessários',
    );
  }
}

const OPEN_STATUSES: ApplicationStatus[] = ['PENDENTE', 'EM_ANALISE', 'AGUARDANDO_DOCUMENTACAO', 'APROVADA'];

export async function createApplication(userId: string, benefitId: string, message?: string) {
  const benefit = await prisma.benefit.findUnique({ where: { id: benefitId } });
  if (!benefit || availability(benefit) !== 'ABERTO') throw badRequest('Este benefício não está aberto para solicitações');
  const existing = await prisma.application.findFirst({ where: { userId, benefitId, status: { in: OPEN_STATUSES } } });
  if (existing) throw conflict('Você já possui uma solicitação em andamento para este benefício');
  const protocol = `MB-${new Date().getFullYear()}-${crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')}`;
  return prisma.application.create({
    data: {
      protocol, userId, benefitId, message: message || null,
      history: { create: { toStatus: 'PENDENTE', note: 'Solicitação registrada', userId } },
    },
    include: { benefit: true },
  });
}

export async function changeStatus(
  applicationId: string,
  to: ApplicationStatus,
  adminId: string,
  note?: string,
) {
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) throw notFound('Solicitação não encontrada');
  validateTransition(app.status, to, note);
  return prisma.application.update({
    where: { id: applicationId },
    data: {
      status: to,
      history: { create: { fromStatus: app.status, toStatus: to, note: note?.trim() || null, adminId } },
    },
  });
}

export async function addNote(applicationId: string, adminId: string, note: string, visibleToUser: boolean) {
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) throw notFound('Solicitação não encontrada');
  return prisma.applicationHistory.create({
    data: { applicationId, fromStatus: app.status, toStatus: app.status, note, visibleToUser, adminId },
  });
}

// ---------- Documentos ----------
const SIGNATURES: { mime: string; ext: string; match: (b: Buffer) => boolean }[] = [
  { mime: 'application/pdf', ext: '.pdf', match: (b) => b.subarray(0, 4).toString() === '%PDF' },
  { mime: 'image/png', ext: '.png', match: (b) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) },
  { mime: 'image/jpeg', ext: '.jpg', match: (b) => b[0] === 0xff && b[1] === 0xd8 },
];

export async function saveDocument(
  applicationId: string,
  file: { originalname: string; buffer: Buffer },
  maxBytes: number,
) {
  if (file.buffer.length > maxBytes) throw badRequest(`Arquivo maior que ${Math.round(maxBytes / 1024 / 1024)} MB`);
  const type = SIGNATURES.find((s) => s.match(file.buffer));
  if (!type) throw badRequest('Formato não permitido. Envie PDF, JPG ou PNG.');
  const storedName = `${crypto.randomUUID()}${type.ext}`;
  const dir = path.resolve(env.UPLOAD_DIR, 'applications');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, storedName), file.buffer);
  return prisma.applicationDocument.create({
    data: {
      applicationId,
      originalName: path.basename(file.originalname).slice(0, 150),
      storedName,
      mimeType: type.mime,
      size: file.buffer.length,
    },
  });
}

export const documentPath = (storedName: string) =>
  path.join(path.resolve(env.UPLOAD_DIR, 'applications'), path.basename(storedName));

export function assertOwner(app: { userId: string }, userId: string) {
  if (app.userId !== userId) throw forbidden('Esta solicitação pertence a outro usuário');
}

/** Ao receber documentos de uma solicitação aguardando documentação, volta para análise. */
export async function afterUserUpload(applicationId: string, userId: string) {
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (app?.status === 'AGUARDANDO_DOCUMENTACAO') {
    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: 'EM_ANALISE',
        history: {
          create: { fromStatus: 'AGUARDANDO_DOCUMENTACAO', toStatus: 'EM_ANALISE', note: 'Documentação complementar enviada', userId },
        },
      },
    });
  }
}

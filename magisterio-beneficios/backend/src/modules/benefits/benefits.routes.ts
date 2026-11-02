import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { asyncHandler, pageParams, paged, parse } from '../../common/http';
import { audit } from '../../common/audit';
import { conflict, notFound } from '../../common/errors';
import { slugify } from '../../common/utils';
import { requireAdmin } from '../../middleware/auth';

const include = { category: true, requirements: { orderBy: { position: 'asc' as const } } };

/** Situação de exibição calculada a partir do status e do período de vigência. */
export function availability(b: { status: string; startDate: Date | null; endDate: Date | null }) {
  if (b.status !== 'PUBLISHED') return 'INDISPONIVEL';
  const now = new Date();
  if (b.startDate && b.startDate > now) return 'EM_BREVE';
  if (b.endDate && b.endDate < now) return 'ENCERRADO';
  return 'ABERTO';
}

const present = <T extends { status: string; startDate: Date | null; endDate: Date | null }>(b: T) => ({
  ...b,
  availability: availability(b),
});

// ---------- Público ----------
export const publicBenefitsRouter = Router();

publicBenefitsRouter.get('/categories', asyncHandler(async (_req, res) => {
  res.json(await prisma.benefitCategory.findMany({ orderBy: { name: 'asc' } }));
}));

publicBenefitsRouter.get('/', asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = pageParams(req.query, 9);
  const q = String(req.query.q ?? '').trim();
  const category = String(req.query.category ?? '').trim();
  const where: Prisma.BenefitWhereInput = {
    status: 'PUBLISHED',
    ...(category ? { category: { slug: category } } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { summary: { contains: q, mode: 'insensitive' } }] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.benefit.findMany({ where, include, orderBy: { name: 'asc' }, skip, take }),
    prisma.benefit.count({ where }),
  ]);
  res.json(paged(items.map(present), total, page, pageSize));
}));

publicBenefitsRouter.get('/:slug', asyncHandler(async (req, res) => {
  const b = await prisma.benefit.findFirst({ where: { slug: String(req.params.slug), status: 'PUBLISHED' }, include });
  if (!b) throw notFound('Benefício não encontrado');
  res.json(present(b));
}));

// ---------- Administração ----------
const benefitSchema = z.object({
  name: z.string().trim().min(3, 'Informe o nome').max(150),
  summary: z.string().trim().min(10, 'Informe um resumo').max(300),
  description: z.string().trim().min(20, 'Descreva o benefício'),
  categoryId: z.coerce.number().int(),
  targetAudience: z.string().trim().min(3, 'Informe o público elegível'),
  requiredDocuments: z.string().trim().min(3, 'Informe a documentação necessária'),
  imageUrl: z.string().trim().url('URL inválida').optional().or(z.literal('')),
  startDate: z.string().optional().or(z.literal('')),
  endDate: z.string().optional().or(z.literal('')),
  requirements: z.array(z.string().trim().min(2)).default([]),
}).refine((d) => !d.startDate || !d.endDate || new Date(d.endDate) >= new Date(d.startDate), {
  message: 'A data de encerramento deve ser posterior à data de início', path: ['endDate'],
});

async function uniqueSlug(name: string, ignoreId?: string) {
  const base = slugify(name) || 'beneficio';
  let slug = base;
  for (let i = 2; await prisma.benefit.findFirst({ where: { slug, NOT: ignoreId ? { id: ignoreId } : undefined } }); i++) {
    slug = `${base}-${i}`;
  }
  return slug;
}

function toData(input: z.infer<typeof benefitSchema>) {
  const { requirements, startDate, endDate, imageUrl, ...rest } = input;
  return {
    ...rest,
    imageUrl: imageUrl || null,
    startDate: startDate ? new Date(startDate) : null,
    endDate: endDate ? new Date(endDate) : null,
    requirements: { create: requirements.map((text, position) => ({ text, position })) },
  };
}

export const adminBenefitsRouter = Router();

adminBenefitsRouter.get('/categories', requireAdmin('benefits:read'), asyncHandler(async (_req, res) => {
  res.json(await prisma.benefitCategory.findMany({ orderBy: { name: 'asc' } }));
}));

adminBenefitsRouter.post('/categories', requireAdmin('benefits:write'), asyncHandler(async (req, res) => {
  const { name } = parse(z.object({ name: z.string().trim().min(3).max(80) }), req.body);
  const slug = slugify(name);
  if (await prisma.benefitCategory.findFirst({ where: { OR: [{ name }, { slug }] } })) throw conflict('Categoria já existe');
  const cat = await prisma.benefitCategory.create({ data: { name, slug } });
  await audit(req, { action: 'CRIAR', module: 'benefícios', recordId: String(cat.id), details: `Categoria "${name}"` });
  res.status(201).json(cat);
}));

adminBenefitsRouter.get('/', requireAdmin('benefits:read'), asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = pageParams(req.query);
  const q = String(req.query.q ?? '').trim();
  const status = String(req.query.status ?? '');
  const where: Prisma.BenefitWhereInput = {
    ...(['DRAFT', 'PUBLISHED', 'UNPUBLISHED'].includes(status) ? { status: status as 'DRAFT' } : {}),
    ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.benefit.findMany({ where, include: { ...include, _count: { select: { applications: true } } }, orderBy: { updatedAt: 'desc' }, skip, take }),
    prisma.benefit.count({ where }),
  ]);
  res.json(paged(items.map(present), total, page, pageSize));
}));

adminBenefitsRouter.get('/:id', requireAdmin('benefits:read'), asyncHandler(async (req, res) => {
  const b = await prisma.benefit.findUnique({ where: { id: String(req.params.id) }, include });
  if (!b) throw notFound();
  res.json(present(b));
}));

adminBenefitsRouter.post('/', requireAdmin('benefits:write'), asyncHandler(async (req, res) => {
  const input = parse(benefitSchema, req.body);
  const b = await prisma.benefit.create({ data: { ...toData(input), slug: await uniqueSlug(input.name) }, include });
  await audit(req, { action: 'CRIAR', module: 'benefícios', recordId: b.id, details: `Benefício "${b.name}"` });
  res.status(201).json(present(b));
}));

adminBenefitsRouter.put('/:id', requireAdmin('benefits:write'), asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const input = parse(benefitSchema, req.body);
  if (!(await prisma.benefit.findUnique({ where: { id } }))) throw notFound();
  const b = await prisma.$transaction(async (tx) => {
    await tx.benefitRequirement.deleteMany({ where: { benefitId: id } });
    return tx.benefit.update({ where: { id }, data: { ...toData(input), slug: await uniqueSlug(input.name, id) }, include });
  });
  await audit(req, { action: 'EDITAR', module: 'benefícios', recordId: id, details: `Benefício "${b.name}"` });
  res.json(present(b));
}));

const setStatus = (status: 'PUBLISHED' | 'UNPUBLISHED', action: string) =>
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    if (!(await prisma.benefit.findUnique({ where: { id } }))) throw notFound();
    const b = await prisma.benefit.update({ where: { id }, data: { status }, include });
    await audit(req, { action, module: 'benefícios', recordId: id, details: `Benefício "${b.name}"` });
    res.json(present(b));
  });

adminBenefitsRouter.post('/:id/publish', requireAdmin('benefits:write'), setStatus('PUBLISHED', 'PUBLICAR'));
adminBenefitsRouter.post('/:id/unpublish', requireAdmin('benefits:write'), setStatus('UNPUBLISHED', 'DESPUBLICAR'));

adminBenefitsRouter.delete('/:id', requireAdmin('benefits:write'), asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const b = await prisma.benefit.findUnique({ where: { id }, include: { _count: { select: { applications: true } } } });
  if (!b) throw notFound();
  if (b._count.applications > 0) {
    throw conflict('Este benefício possui solicitações vinculadas e não pode ser excluído. Despublique-o para retirá-lo do portal.');
  }
  await prisma.benefit.delete({ where: { id } });
  await audit(req, { action: 'EXCLUIR', module: 'benefícios', recordId: id, details: `Benefício "${b.name}"` });
  res.json({ ok: true });
}));

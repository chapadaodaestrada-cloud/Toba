import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { asyncHandler, pageParams, paged, parse } from '../../common/http';
import { audit } from '../../common/audit';
import { badRequest, conflict, notFound } from '../../common/errors';
import { slugify } from '../../common/utils';
import { requireAdmin } from '../../middleware/auth';

const include = { category: true, author: { select: { name: true } } };

/** Publicadas: status PUBLISHED, ou SCHEDULED cuja data já chegou (publicação programada sem necessidade de job). */
const visibleNow = (): Prisma.NewsWhereInput => ({
  status: { in: ['PUBLISHED', 'SCHEDULED'] },
  publishedAt: { lte: new Date() },
});

// ---------- Público ----------
export const publicNewsRouter = Router();

publicNewsRouter.get('/categories', asyncHandler(async (_req, res) => {
  res.json(await prisma.newsCategory.findMany({ orderBy: { name: 'asc' } }));
}));

publicNewsRouter.get('/', asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = pageParams(req.query, 9);
  const category = String(req.query.category ?? '').trim();
  const where: Prisma.NewsWhereInput = { ...visibleNow(), ...(category ? { category: { slug: category } } : {}) };
  const [items, total] = await Promise.all([
    prisma.news.findMany({ where, include, orderBy: { publishedAt: 'desc' }, skip, take }),
    prisma.news.count({ where }),
  ]);
  res.json(paged(items, total, page, pageSize));
}));

publicNewsRouter.get('/:slug', asyncHandler(async (req, res) => {
  const n = await prisma.news.findFirst({ where: { slug: String(req.params.slug), ...visibleNow() }, include });
  if (!n) throw notFound('Publicação não encontrada');
  res.json(n);
}));

// ---------- Administração ----------
const newsSchema = z.object({
  title: z.string().trim().min(5, 'Informe o título').max(180),
  excerpt: z.string().trim().min(10, 'Informe um resumo').max(300),
  content: z.string().trim().min(20, 'Escreva o conteúdo'),
  categoryId: z.coerce.number().int(),
  imageUrl: z.string().trim().url('URL inválida').optional().or(z.literal('')),
  scheduledFor: z.string().optional().or(z.literal('')),
});

async function uniqueSlug(title: string, ignoreId?: string) {
  const base = slugify(title) || 'publicacao';
  let slug = base;
  for (let i = 2; await prisma.news.findFirst({ where: { slug, NOT: ignoreId ? { id: ignoreId } : undefined } }); i++) {
    slug = `${base}-${i}`;
  }
  return slug;
}

export const adminNewsRouter = Router();

adminNewsRouter.get('/categories', requireAdmin('news:read'), asyncHandler(async (_req, res) => {
  res.json(await prisma.newsCategory.findMany({ orderBy: { name: 'asc' } }));
}));

adminNewsRouter.post('/categories', requireAdmin('news:write'), asyncHandler(async (req, res) => {
  const { name } = parse(z.object({ name: z.string().trim().min(3).max(80) }), req.body);
  const slug = slugify(name);
  if (await prisma.newsCategory.findFirst({ where: { OR: [{ name }, { slug }] } })) throw conflict('Categoria já existe');
  const cat = await prisma.newsCategory.create({ data: { name, slug } });
  await audit(req, { action: 'CRIAR', module: 'notícias', recordId: String(cat.id), details: `Categoria "${name}"` });
  res.status(201).json(cat);
}));

adminNewsRouter.get('/', requireAdmin('news:read'), asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = pageParams(req.query);
  const q = String(req.query.q ?? '').trim();
  const status = String(req.query.status ?? '');
  const where: Prisma.NewsWhereInput = {
    ...(['DRAFT', 'SCHEDULED', 'PUBLISHED', 'UNPUBLISHED'].includes(status) ? { status: status as 'DRAFT' } : {}),
    ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.news.findMany({ where, include, orderBy: { updatedAt: 'desc' }, skip, take }),
    prisma.news.count({ where }),
  ]);
  res.json(paged(items, total, page, pageSize));
}));

adminNewsRouter.get('/:id', requireAdmin('news:read'), asyncHandler(async (req, res) => {
  const n = await prisma.news.findUnique({ where: { id: String(req.params.id) }, include });
  if (!n) throw notFound();
  res.json(n);
}));

adminNewsRouter.post('/', requireAdmin('news:write'), asyncHandler(async (req, res) => {
  const { scheduledFor, imageUrl, ...input } = parse(newsSchema, req.body);
  const n = await prisma.news.create({
    data: { ...input, imageUrl: imageUrl || null, slug: await uniqueSlug(input.title), authorId: req.admin!.id,
      ...(scheduledFor ? { status: 'SCHEDULED', publishedAt: new Date(scheduledFor) } : {}) },
    include,
  });
  await audit(req, { action: 'CRIAR', module: 'notícias', recordId: n.id, details: `Publicação "${n.title}" (${n.status})` });
  res.status(201).json(n);
}));

adminNewsRouter.put('/:id', requireAdmin('news:write'), asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const { scheduledFor, imageUrl, ...input } = parse(newsSchema, req.body);
  const current = await prisma.news.findUnique({ where: { id } });
  if (!current) throw notFound();
  const schedule = scheduledFor
    ? { status: 'SCHEDULED' as const, publishedAt: new Date(scheduledFor) }
    : current.status === 'SCHEDULED' ? { status: 'DRAFT' as const, publishedAt: null } : {};
  const n = await prisma.news.update({
    where: { id },
    data: { ...input, imageUrl: imageUrl || null, slug: await uniqueSlug(input.title, id), ...schedule },
    include,
  });
  await audit(req, { action: 'EDITAR', module: 'notícias', recordId: id, details: `Publicação "${n.title}"` });
  res.json(n);
}));

adminNewsRouter.post('/:id/publish', requireAdmin('news:write'), asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  if (!(await prisma.news.findUnique({ where: { id } }))) throw notFound();
  const n = await prisma.news.update({ where: { id }, data: { status: 'PUBLISHED', publishedAt: new Date() }, include });
  await audit(req, { action: 'PUBLICAR', module: 'notícias', recordId: id, details: `Publicação "${n.title}"` });
  res.json(n);
}));

adminNewsRouter.post('/:id/unpublish', requireAdmin('news:write'), asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const current = await prisma.news.findUnique({ where: { id } });
  if (!current) throw notFound();
  if (current.status === 'DRAFT') throw badRequest('Rascunhos não estão publicados');
  const n = await prisma.news.update({ where: { id }, data: { status: 'UNPUBLISHED' }, include });
  await audit(req, { action: 'DESPUBLICAR', module: 'notícias', recordId: id, details: `Publicação "${n.title}"` });
  res.json(n);
}));

adminNewsRouter.delete('/:id', requireAdmin('news:write'), asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const n = await prisma.news.findUnique({ where: { id } });
  if (!n) throw notFound();
  await prisma.news.delete({ where: { id } });
  await audit(req, { action: 'EXCLUIR', module: 'notícias', recordId: id, details: `Publicação "${n.title}"` });
  res.json({ ok: true });
}));

import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { asyncHandler, pageParams, paged, parse } from '../../common/http';
import { audit } from '../../common/audit';
import { conflict, notFound, unauthorized } from '../../common/errors';
import { hashPassword, maskCpf, onlyDigits, verifyPassword } from '../../common/utils';
import { requireAdmin, requireUser } from '../../middleware/auth';
import { passwordField } from '../auth/auth.service';

const publicFields = {
  id: true, name: true, cpf: true, email: true, phone: true, birthDate: true, institution: true,
  position: true, city: true, state: true, active: true, createdAt: true, lastLoginAt: true,
} as const;

const profileSchema = z.object({
  name: z.string().trim().min(5, 'Informe o nome completo').max(120),
  phone: z.string().transform(onlyDigits).refine((v) => v.length >= 10 && v.length <= 11, 'Telefone invÃ¡lido'),
  birthDate: z.string().optional().or(z.literal('')),
  institution: z.string().trim().max(150).optional().or(z.literal('')),
  position: z.string().trim().max(100).optional().or(z.literal('')),
  city: z.string().trim().max(100).optional().or(z.literal('')),
  state: z.string().trim().length(2).toUpperCase().optional().or(z.literal('')),
});

const profileData = (p: z.infer<typeof profileSchema>) => ({
  name: p.name, phone: p.phone,
  birthDate: p.birthDate ? new Date(p.birthDate) : null,
  institution: p.institution || null, position: p.position || null,
  city: p.city || null, state: p.state || null,
});

// ---------- Ãrea do usuÃ¡rio ----------
export const profileRouter = Router();
profileRouter.use(requireUser);

profileRouter.get('/', asyncHandler(async (req, res) => {
  res.json(await prisma.user.findUnique({ where: { id: req.user!.id }, select: publicFields }));
}));

profileRouter.put('/', asyncHandler(async (req, res) => {
  const data = profileData(parse(profileSchema, req.body));
  res.json(await prisma.user.update({ where: { id: req.user!.id }, data, select: publicFields }));
}));

profileRouter.put('/password', asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = parse(
    z.object({ currentPassword: z.string().min(1, 'Informe a senha atual'), newPassword: passwordField }),
    req.body,
  );
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) throw unauthorized('Senha atual incorreta');
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } });
  res.json({ ok: true });
}));

profileRouter.get('/dashboard', asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  const [user, apps, recent, benefits, news] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: publicFields }),
    prisma.application.groupBy({ by: ['status'], where: { userId }, _count: true }),
    prisma.applicationHistory.findMany({
      where: { application: { userId }, visibleToUser: true },
      orderBy: { createdAt: 'desc' }, take: 6,
      include: { application: { select: { protocol: true, benefit: { select: { name: true } } } } },
    }),
    prisma.benefit.findMany({
      where: { status: 'PUBLISHED' }, orderBy: { updatedAt: 'desc' }, take: 4,
      include: { category: true },
    }),
    prisma.news.findMany({
      where: { status: { in: ['PUBLISHED', 'SCHEDULED'] }, publishedAt: { lte: new Date() } },
      orderBy: { publishedAt: 'desc' }, take: 3, include: { category: true },
    }),
  ]);
  res.json({
    user,
    applicationsByStatus: Object.fromEntries(apps.map((a) => [a.status, a._count])),
    recentHistory: recent,
    availableBenefits: benefits,
    news,
  });
}));

// ---------- AdministraÃ§Ã£o ----------
export const adminUsersRouter = Router();

adminUsersRouter.get('/', requireAdmin('users:read'), asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = pageParams(req.query);
  const q = String(req.query.q ?? '').trim();
  const active = String(req.query.active ?? '');
  const digits = onlyDigits(q);
  const where: Prisma.UserWhereInput = {
    ...(active === 'true' ? { active: true } : active === 'false' ? { active: false } : {}),
    ...(q ? { OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      ...(digits.length >= 3 ? [{ cpf: { contains: digits } }] : []),
    ] } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where, skip, take, orderBy: { createdAt: 'desc' },
      select: { ...publicFields, _count: { select: { applications: true } } },
    }),
    prisma.user.count({ where }),
  ]);
  res.json(paged(items.map((u) => ({ ...u, cpf: maskCpf(u.cpf) })), total, page, pageSize));
}));

adminUsersRouter.get('/:id', requireAdmin('users:read'), asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      ...publicFields,
      applications: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, protocol: true, status: true, createdAt: true, benefit: { select: { name: true } } },
      },
    },
  });
  if (!user) throw notFound('UsuÃ¡rio nÃ£o encontrado');
  const activities = await prisma.adminActivity.findMany({
    where: { module: 'usuÃ¡rios', recordId: id },
    orderBy: { createdAt: 'desc' }, take: 20,
    include: { admin: { select: { name: true } } },
  });
  res.json({ ...user, cpf: maskCpf(user.cpf), activities });
}));

adminUsersRouter.put('/:id', requireAdmin('users:write'), asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const input = parse(profileSchema.extend({ email: z.string().trim().toLowerCase().email('E-mail invÃ¡lido') }), req.body);
  if (!(await prisma.user.findUnique({ where: { id } }))) throw notFound('UsuÃ¡rio nÃ£o encontrado');
  if (await prisma.user.findFirst({ where: { email: input.email, NOT: { id } } })) throw conflict('E-mail jÃ¡ cadastrado');
  const user = await prisma.user.update({
    where: { id }, data: { ...profileData(input), email: input.email }, select: publicFields,
  });
  await audit(req, { action: 'EDITAR', module: 'usuÃ¡rios', recordId: id, details: `Cadastro de ${user.name}` });
  res.json({ ...user, cpf: maskCpf(user.cpf) });
}));

adminUsersRouter.post('/:id/active', requireAdmin('users:write'), asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const { active } = parse(z.object({ active: z.boolean() }), req.body);
  if (!(await prisma.user.findUnique({ where: { id } }))) throw notFound('UsuÃ¡rio nÃ£o encontrado');
  const user = await prisma.user.update({ where: { id }, data: { active }, select: publicFields });
  await audit(req, { action: active ? 'ATIVAR' : 'DESATIVAR', module: 'usuÃ¡rios', recordId: id, details: user.name });
  res.json({ ...user, cpf: maskCpf(user.cpf) });
}));


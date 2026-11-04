import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../database/prisma';
import { asyncHandler, pageParams, paged, parse } from '../../common/http';
import { audit } from '../../common/audit';
import { badRequest, conflict, notFound } from '../../common/errors';
import { hashPassword } from '../../common/utils';
import { PERMISSIONS, type PermissionKey } from '../../common/permissions';
import { requireAdmin } from '../../middleware/auth';
import { passwordField } from '../auth/auth.service';

export const adminAdminsRouter = Router();
adminAdminsRouter.use(requireAdmin('admins:manage'));

const select = {
  id: true, name: true, email: true, active: true, lastLoginAt: true, createdAt: true,
  role: { select: { id: true, key: true, name: true } },
} as const;

async function activeSuperAdmins(excludeId?: string) {
  return prisma.admin.count({
    where: { active: true, role: { key: 'SUPER_ADMIN' }, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
  });
}

adminAdminsRouter.get('/roles', asyncHandler(async (_req, res) => {
  const roles = await prisma.role.findMany({
    orderBy: { id: 'asc' },
    include: { permissions: { include: { permission: true } }, _count: { select: { admins: true } } },
  });
  res.json({
    permissions: Object.entries(PERMISSIONS).map(([key, label]) => ({ key, label })),
    roles: roles.map((r) => ({
      id: r.id, key: r.key, name: r.name, description: r.description, admins: r._count.admins,
      permissions: r.permissions.map((p) => p.permission.key),
    })),
  });
}));

adminAdminsRouter.put('/roles/:key', asyncHandler(async (req, res) => {
  const key = String(req.params.key);
  const role = await prisma.role.findUnique({ where: { key } });
  if (!role) throw notFound('Perfil não encontrado');
  if (key === 'SUPER_ADMIN') throw badRequest('As permissões do Super administrador não podem ser alteradas');
  const { permissions } = parse(
    z.object({ permissions: z.array(z.string()).refine((p) => p.every((k) => k in PERMISSIONS), 'Permissão desconhecida') }),
    req.body,
  );
  const perms = await prisma.permission.findMany({ where: { key: { in: permissions as PermissionKey[] } } });
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
    prisma.rolePermission.createMany({ data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })) }),
  ]);
  await audit(req, { action: 'EDITAR_PERMISSOES', module: 'administradores', recordId: key, details: permissions.join(', ') });
  res.json({ ok: true });
}));

adminAdminsRouter.get('/', asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = pageParams(req.query);
  const q = String(req.query.q ?? '').trim();
  const where = q ? { OR: [{ name: { contains: q, mode: 'insensitive' as const } }, { email: { contains: q, mode: 'insensitive' as const } }] } : {};
  const [items, total] = await Promise.all([
    prisma.admin.findMany({ where, select, orderBy: { createdAt: 'asc' }, skip, take }),
    prisma.admin.count({ where }),
  ]);
  res.json(paged(items, total, page, pageSize));
}));

adminAdminsRouter.get('/:id', asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const admin = await prisma.admin.findUnique({ where: { id }, select });
  if (!admin) throw notFound('Administrador não encontrado');
  const activities = await prisma.adminActivity.findMany({ where: { adminId: id }, orderBy: { createdAt: 'desc' }, take: 25 });
  res.json({ ...admin, activities });
}));

const baseSchema = z.object({
  name: z.string().trim().min(3, 'Informe o nome').max(120),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  roleKey: z.enum(['SUPER_ADMIN', 'ADMIN', 'OPERADOR']),
});

adminAdminsRouter.post('/', asyncHandler(async (req, res) => {
  const input = parse(baseSchema.extend({ password: passwordField }), req.body);
  if (await prisma.admin.findUnique({ where: { email: input.email } })) throw conflict('E-mail já cadastrado');
  const role = await prisma.role.findUnique({ where: { key: input.roleKey } });
  if (!role) throw badRequest('Perfil inválido');
  const admin = await prisma.admin.create({
    data: { name: input.name, email: input.email, roleId: role.id, passwordHash: await hashPassword(input.password) },
    select,
  });
  await audit(req, { action: 'CRIAR', module: 'administradores', recordId: admin.id, details: `${admin.name} (${input.roleKey})` });
  res.status(201).json(admin);
}));

adminAdminsRouter.put('/:id', asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const input = parse(baseSchema.extend({ password: passwordField.optional().or(z.literal('')) }), req.body);
  const current = await prisma.admin.findUnique({ where: { id }, include: { role: true } });
  if (!current) throw notFound('Administrador não encontrado');
  if (await prisma.admin.findFirst({ where: { email: input.email, NOT: { id } } })) throw conflict('E-mail já cadastrado');
  const role = await prisma.role.findUnique({ where: { key: input.roleKey } });
  if (!role) throw badRequest('Perfil inválido');
  if (current.role.key === 'SUPER_ADMIN' && input.roleKey !== 'SUPER_ADMIN' && (await activeSuperAdmins(id)) === 0) {
    throw badRequest('Deve existir ao menos um Super administrador ativo');
  }
  const admin = await prisma.admin.update({
    where: { id },
    data: {
      name: input.name, email: input.email, roleId: role.id,
      ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}),
    },
    select,
  });
  await audit(req, { action: 'EDITAR', module: 'administradores', recordId: id, details: `${admin.name} (${input.roleKey})` });
  res.json(admin);
}));

adminAdminsRouter.post('/:id/active', asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const { active } = parse(z.object({ active: z.boolean() }), req.body);
  const current = await prisma.admin.findUnique({ where: { id }, include: { role: true } });
  if (!current) throw notFound('Administrador não encontrado');
  if (!active) {
    if (id === req.admin!.id) throw badRequest('Você não pode desativar a própria conta');
    if (current.role.key === 'SUPER_ADMIN' && (await activeSuperAdmins(id)) === 0) {
      throw badRequest('Deve existir ao menos um Super administrador ativo');
    }
  }
  const admin = await prisma.admin.update({ where: { id }, data: { active }, select });
  await audit(req, { action: active ? 'ATIVAR' : 'DESATIVAR', module: 'administradores', recordId: id, details: admin.name });
  res.json(admin);
}));

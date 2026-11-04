import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { env } from '../../config/env';
import { asyncHandler, pageParams, paged, parse } from '../../common/http';
import { audit } from '../../common/audit';
import { requireAdmin } from '../../middleware/auth';

// ---------- Configurações ----------
async function getSettings() {
  return prisma.platformSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

export const publicSettingsRouter = Router();
publicSettingsRouter.get('/', asyncHandler(async (_req, res) => {
  const s = await getSettings();
  res.json({
    platformName: s.platformName, logoUrl: s.logoUrl, about: s.about, contactEmail: s.contactEmail,
    contactPhone: s.contactPhone, address: s.address, instagram: s.instagram, facebook: s.facebook,
    youtube: s.youtube, maintenanceMode: s.maintenanceMode, demoMode: env.demoMode,
  });
}));

const optionalUrl = z.string().trim().url('URL inválida').optional().or(z.literal(''));
const settingsSchema = z.object({
  platformName: z.string().trim().min(3).max(80),
  logoUrl: optionalUrl,
  about: z.string().trim().max(2000),
  contactEmail: z.string().trim().email('E-mail inválido').or(z.literal('')),
  contactPhone: z.string().trim().max(30),
  address: z.string().trim().max(250),
  instagram: optionalUrl,
  facebook: optionalUrl,
  youtube: optionalUrl,
  maxUploadMb: z.coerce.number().int().min(1).max(10),
  notifyNewApplication: z.boolean(),
  notifyStatusChange: z.boolean(),
  maintenanceMode: z.boolean(),
});

export const adminSettingsRouter = Router();
adminSettingsRouter.get('/', requireAdmin('settings:read'), asyncHandler(async (_req, res) => {
  res.json(await getSettings());
}));
adminSettingsRouter.put('/', requireAdmin('settings:write'), asyncHandler(async (req, res) => {
  const d = parse(settingsSchema, req.body);
  const data = { ...d, logoUrl: d.logoUrl || null, instagram: d.instagram || null, facebook: d.facebook || null, youtube: d.youtube || null };
  await getSettings();
  const s = await prisma.platformSettings.update({ where: { id: 1 }, data });
  await audit(req, { action: 'EDITAR', module: 'configurações', recordId: '1', details: 'Configurações gerais atualizadas' });
  res.json(s);
}));

// ---------- Atividades (somente leitura) ----------
export const adminActivitiesRouter = Router();
adminActivitiesRouter.get('/', requireAdmin('activities:read'), asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = pageParams(req.query, 20);
  const module = String(req.query.module ?? '').trim();
  const adminId = String(req.query.adminId ?? '').trim();
  const where: Prisma.AdminActivityWhereInput = {
    ...(module ? { module } : {}),
    ...(adminId ? { adminId } : {}),
  };
  const [items, total, modules] = await Promise.all([
    prisma.adminActivity.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, include: { admin: { select: { name: true, email: true } } } }),
    prisma.adminActivity.count({ where }),
    prisma.adminActivity.findMany({ distinct: ['module'], select: { module: true } }),
  ]);
  res.json({ ...paged(items, total, page, pageSize), modules: modules.map((m) => m.module) });
}));

// ---------- Dashboard ----------
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

function lastMonths(n: number) {
  const out: { key: string; label: string; start: Date }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: monthKey(d), label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), start: d });
  }
  return out;
}

export const adminDashboardRouter = Router();
adminDashboardRouter.get('/', requireAdmin(), asyncHandler(async (req, res) => {
  const months = lastMonths(6);
  const since = months[0].start;
  const [totalUsers, activeUsers, publishedBenefits, byStatus, usersSeries, appsSeries, topRaw, activities] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { active: true } }),
    prisma.benefit.count({ where: { status: 'PUBLISHED' } }),
    prisma.application.groupBy({ by: ['status'], _count: true }),
    prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.application.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.application.groupBy({ by: ['benefitId'], _count: true, orderBy: { _count: { benefitId: 'desc' } }, take: 5 }),
    req.admin!.permissions.includes('activities:read')
      ? prisma.adminActivity.findMany({ orderBy: { createdAt: 'desc' }, take: 8, include: { admin: { select: { name: true } } } })
      : Promise.resolve([]),
  ]);
  const count = (s: string) => byStatus.find((b) => b.status === s)?._count ?? 0;
  const benefitNames = await prisma.benefit.findMany({ where: { id: { in: topRaw.map((t) => t.benefitId) } }, select: { id: true, name: true } });
  const series = (rows: { createdAt: Date }[]) =>
    months.map((m) => ({ month: m.label, total: rows.filter((r) => monthKey(r.createdAt) === m.key).length }));

  res.json({
    totals: {
      users: totalUsers, activeUsers, publishedBenefits,
      applications: byStatus.reduce((s, b) => s + b._count, 0),
      pending: count('PENDENTE'), approved: count('APROVADA'), refused: count('RECUSADA'),
    },
    registrations: series(usersSeries),
    applicationsByMonth: series(appsSeries),
    statusDistribution: byStatus.map((b) => ({ status: b.status, total: b._count })),
    topBenefits: topRaw.map((t) => ({ name: benefitNames.find((b) => b.id === t.benefitId)?.name ?? '—', total: t._count })),
    recentActivities: activities,
  });
}));

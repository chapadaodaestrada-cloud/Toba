import type { Request } from 'express';
import { prisma } from '../database/prisma';

export async function audit(
  req: Request,
  entry: { action: string; module: string; recordId?: string; details?: string },
) {
  await prisma.adminActivity.create({
    data: { ...entry, adminId: req.admin?.id ?? null, ip: req.ip ?? null },
  });
}

export async function authLog(
  actor: 'USER' | 'ADMIN',
  email: string,
  success: boolean,
  req: Request,
  reason?: string,
) {
  await prisma.authLog.create({ data: { actor, email, success, reason, ip: req.ip ?? null } });
}

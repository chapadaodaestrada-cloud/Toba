import type { NextFunction, Request, Response } from 'express';
import type { CookieOptions } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../database/prisma';
import { forbidden, unauthorized } from '../common/errors';
import type { PermissionKey } from '../common/permissions';

export const USER_COOKIE = 'mb_user';
export const ADMIN_COOKIE = 'mb_admin';

export interface AuthedAdmin {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; name: string; email: string };
      admin?: AuthedAdmin;
    }
  }
}

const cookieOptions = (maxAgeMs: number): CookieOptions => ({
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: 'lax',
  path: '/',
  maxAge: maxAgeMs,
});

export function setSession(res: Response, kind: 'user' | 'admin', id: string) {
  const secret = kind === 'user' ? env.JWT_USER_SECRET : env.JWT_ADMIN_SECRET;
  const ttl = kind === 'user' ? 7 * 24 * 3600 : 8 * 3600;
  const token = jwt.sign({ sub: id, kind }, secret, { expiresIn: ttl });
  res.cookie(kind === 'user' ? USER_COOKIE : ADMIN_COOKIE, token, cookieOptions(ttl * 1000));
}

export function clearSession(res: Response, kind: 'user' | 'admin') {
  res.clearCookie(kind === 'user' ? USER_COOKIE : ADMIN_COOKIE, { ...cookieOptions(0), maxAge: undefined });
}

function readToken(req: Request, cookie: string, secret: string, kind: string): string | null {
  const token = req.cookies?.[cookie];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, secret) as jwt.JwtPayload;
    return payload.kind === kind && typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function requireUser(req: Request, _res: Response, next: NextFunction) {
  try {
    const id = readToken(req, USER_COOKIE, env.JWT_USER_SECRET, 'user');
    if (!id) throw unauthorized();
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || !user.active) throw unauthorized('Conta inexistente ou desativada');
    req.user = { id: user.id, name: user.name, email: user.email };
    next();
  } catch (e) {
    next(e);
  }
}

export async function loadAdmin(req: Request): Promise<AuthedAdmin | null> {
  const id = readToken(req, ADMIN_COOKIE, env.JWT_ADMIN_SECRET, 'admin');
  if (!id) return null;
  const admin = await prisma.admin.findUnique({
    where: { id },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });
  if (!admin || !admin.active) return null;
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role.key,
    permissions: admin.role.permissions.map((p) => p.permission.key),
  };
}

/** Exige administrador autenticado e, opcionalmente, uma permissão. A checagem é sempre feita no servidor. */
export const requireAdmin =
  (permission?: PermissionKey) => async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const admin = await loadAdmin(req);
      if (!admin) throw unauthorized('Sessão administrativa inválida ou expirada');
      if (permission && !admin.permissions.includes(permission)) throw forbidden();
      req.admin = admin;
      next();
    } catch (e) {
      next(e);
    }
  };

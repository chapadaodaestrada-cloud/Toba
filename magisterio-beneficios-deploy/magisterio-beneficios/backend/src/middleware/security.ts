import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import { AppError } from '../common/errors';
import { env } from '../config/env';

/** Proteção CSRF: mutações exigem cabeçalho customizado (não enviável por formulários de outros sites). */
export function csrfGuard(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.header('x-requested-with') !== 'magisterio-web') {
    return next(new AppError(403, 'Requisição bloqueada pela proteção CSRF', 'CSRF'));
  }
  next();
}

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === 'test' ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.', code: 'RATE_LIMIT' },
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.NODE_ENV === 'test' ? 10000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite de requisições excedido.', code: 'RATE_LIMIT' },
});

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, 'Rota não encontrada', 'NOT_FOUND'));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Dados inválidos', code: 'BAD_REQUEST', details: err.flatten().fieldErrors });
  }
  if ((err as { code?: string })?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Arquivo excede o tamanho máximo permitido', code: 'FILE_TOO_LARGE' });
  }
  console.error('[erro]', err instanceof Error ? err.message : err);
  res.status(500).json({ error: 'Erro interno do servidor', code: 'INTERNAL' });
}

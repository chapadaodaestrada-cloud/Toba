import { Router } from 'express';
import { prisma } from '../../database/prisma';
import { env } from '../../config/env';
import { asyncHandler, parse } from '../../common/http';
import { audit } from '../../common/audit';
import { clearSession, requireAdmin, requireUser, setSession } from '../../middleware/auth';
import { loginLimiter } from '../../middleware/security';
import {
  authenticate, createResetToken, forgotSchema, loginSchema, registerSchema, registerUser, resetPassword, resetSchema,
} from './auth.service';

const FORGOT_MESSAGE = 'Se o e-mail estiver cadastrado, enviaremos as instruções de redefinição.';

// ---------- Usuários (professores) ----------
export const authRouter = Router();

authRouter.post('/register', loginLimiter, asyncHandler(async (req, res) => {
  const user = await registerUser(parse(registerSchema, req.body));
  setSession(res, 'user', user.id);
  res.status(201).json({ id: user.id, name: user.name, email: user.email });
}));

authRouter.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  const account = await prisma.user.findUnique({ where: { email } });
  const user = await authenticate('USER', req, email, password, account, (id, data) =>
    prisma.user.update({ where: { id }, data }),
  );
  setSession(res, 'user', user.id);
  res.json({ id: user.id, name: account!.name, email });
}));

authRouter.post('/logout', (_req, res) => {
  clearSession(res, 'user');
  res.json({ ok: true });
});

authRouter.get('/me', requireUser, (req, res) => res.json(req.user));

authRouter.post('/forgot-password', loginLimiter, asyncHandler(async (req, res) => {
  const { email } = parse(forgotSchema, req.body);
  const token = await createResetToken('USER', email);
  res.json({ message: FORGOT_MESSAGE, emailDelivery: 'not_configured', ...(token && !env.isProd ? { devToken: token } : {}) });
}));

authRouter.post('/reset-password', loginLimiter, asyncHandler(async (req, res) => {
  const { token, password } = parse(resetSchema, req.body);
  await resetPassword('USER', token, password);
  res.json({ message: 'Senha redefinida com sucesso' });
}));

// ---------- Administradores ----------
export const adminAuthRouter = Router();

adminAuthRouter.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  const account = await prisma.admin.findUnique({ where: { email } });
  const admin = await authenticate('ADMIN', req, email, password, account, (id, data) =>
    prisma.admin.update({ where: { id }, data }),
  );
  setSession(res, 'admin', admin.id);
  req.admin = { id: admin.id, name: account!.name, email, role: '', permissions: [] };
  await audit(req, { action: 'LOGIN', module: 'auth', recordId: admin.id, details: 'Login administrativo' });
  res.json({ ok: true });
}));

adminAuthRouter.post('/logout', asyncHandler(async (req, res) => {
  clearSession(res, 'admin');
  res.json({ ok: true });
}));

adminAuthRouter.get('/me', requireAdmin(), (req, res) => res.json(req.admin));

adminAuthRouter.post('/forgot-password', loginLimiter, asyncHandler(async (req, res) => {
  const { email } = parse(forgotSchema, req.body);
  const token = await createResetToken('ADMIN', email);
  res.json({ message: FORGOT_MESSAGE, emailDelivery: 'not_configured', ...(token && !env.isProd ? { devToken: token } : {}) });
}));

adminAuthRouter.post('/reset-password', loginLimiter, asyncHandler(async (req, res) => {
  const { token, password } = parse(resetSchema, req.body);
  await resetPassword('ADMIN', token, password);
  res.json({ message: 'Senha redefinida com sucesso' });
}));

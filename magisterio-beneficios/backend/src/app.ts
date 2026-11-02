import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { apiLimiter, csrfGuard, errorHandler, notFoundHandler } from './middleware/security';
import { adminAuthRouter, authRouter } from './modules/auth/auth.routes';
import { adminBenefitsRouter, publicBenefitsRouter } from './modules/benefits/benefits.routes';
import { adminNewsRouter, publicNewsRouter } from './modules/news/news.routes';
import { adminApplicationsRouter, userApplicationsRouter } from './modules/applications/applications.routes';
import { adminUsersRouter, profileRouter } from './modules/users/users.routes';
import { adminAdminsRouter } from './modules/admins/admins.routes';
import {
  adminActivitiesRouter, adminDashboardRouter, adminSettingsRouter, publicSettingsRouter,
} from './modules/platform/platform.routes';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());
  app.use('/api', apiLimiter, csrfGuard);

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  // Portal público
  app.use('/api/public/benefits', publicBenefitsRouter);
  app.use('/api/public/news', publicNewsRouter);
  app.use('/api/public/settings', publicSettingsRouter);

  // Área do usuário
  app.use('/api/auth', authRouter);
  app.use('/api/me/profile', profileRouter);
  app.use('/api/me/applications', userApplicationsRouter);

  // Painel administrativo
  app.use('/api/admin/auth', adminAuthRouter);
  app.use('/api/admin/dashboard', adminDashboardRouter);
  app.use('/api/admin/users', adminUsersRouter);
  app.use('/api/admin/benefits', adminBenefitsRouter);
  app.use('/api/admin/applications', adminApplicationsRouter);
  app.use('/api/admin/news', adminNewsRouter);
  app.use('/api/admin/admins', adminAdminsRouter);
  app.use('/api/admin/activities', adminActivitiesRouter);
  app.use('/api/admin/settings', adminSettingsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

import fs from 'node:fs';
import path from 'node:path';
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
  // imgSrc libera imagens https externas (logotipo, benefícios e notícias são cadastrados por URL).
  app.use(helmet({
    contentSecurityPolicy: {
      directives: { ...helmet.contentSecurityPolicy.getDefaultDirectives(), 'img-src': ["'self'", 'data:', 'https:'] },
    },
  }));
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

  // Frontend (build do Vite) servido pela própria API: mesmo domínio, sem proxy extra.
  const distDir = env.FRONTEND_DIST
    ? path.resolve(env.FRONTEND_DIST)
    : path.resolve(__dirname, '../../frontend/dist');
  const indexFile = path.join(distDir, 'index.html');
  if (fs.existsSync(indexFile)) {
    app.use('/api', notFoundHandler);
    app.use(express.static(distDir, {
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }));
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(indexFile);
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

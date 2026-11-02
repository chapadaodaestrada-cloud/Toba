import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3333),
  DATABASE_URL: z.string().min(1),
  JWT_USER_SECRET: z.string().min(32, 'JWT_USER_SECRET precisa ter ao menos 32 caracteres'),
  JWT_ADMIN_SECRET: z.string().min(32, 'JWT_ADMIN_SECRET precisa ter ao menos 32 caracteres'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  UPLOAD_DIR: z.string().default('./uploads'),
  DEMO_MODE: z.enum(['true', 'false']).default('false'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Variáveis de ambiente inválidas:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  cookieSecure: parsed.data.COOKIE_SECURE === 'true',
  demoMode: parsed.data.DEMO_MODE === 'true',
  isProd: parsed.data.NODE_ENV === 'production',
  corsOrigins: parsed.data.CORS_ORIGIN.split(',').map((o) => o.trim()),
};

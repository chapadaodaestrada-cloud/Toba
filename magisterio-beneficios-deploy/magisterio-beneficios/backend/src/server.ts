import { createApp } from './app';
import { env } from './config/env';

createApp().listen(env.PORT, () => {
  console.log(`[api] Magistério Benefícios em http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

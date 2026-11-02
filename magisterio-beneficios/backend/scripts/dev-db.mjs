// PostgreSQL embutido (PGlite) apenas para desenvolvimento local sem Docker.
// Em produção use um PostgreSQL real (veja docker-compose.yml e docs/DEPLOYMENT.md).
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const dataDir = process.env.DEV_DB_DIR ?? './.devdb';
const port = Number(process.env.DEV_DB_PORT ?? 5433);

const db = await PGlite.create(dataDir);
const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1' });
await server.start();
console.log(`[dev-db] PostgreSQL (PGlite) em 127.0.0.1:${port} — dados em ${dataDir}`);

const stop = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

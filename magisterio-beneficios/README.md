# Magistério Benefícios

Plataforma institucional independente (não é órgão governamental) com portal público, área do usuário e painel administrativo.

- **frontend/** — React 19 + TypeScript + Vite + Tailwind CSS 4, React Router, TanStack Query, React Hook Form + Zod, Recharts, Lucide.
- **backend/** — Node.js + TypeScript + Express 4, Prisma 6, PostgreSQL, JWT em cookie httpOnly, Zod, bcrypt, Helmet, rate limiting.
- **docs/** — [ARCHITECTURE](docs/ARCHITECTURE.md), [API](docs/API.md), [DEPLOYMENT](docs/DEPLOYMENT.md).

## Execução local

Requisitos: Node.js 20+ (testado com 26). PostgreSQL é opcional em desenvolvimento: `npm run db:dev` sobe um PostgreSQL embutido (PGlite) na porta 5433, sem Docker.

```bash
cd backend
npm install
cp .env.example .env          # edite segredos JWT e SEED_SUPERADMIN_PASSWORD
```

Para usar o banco embutido, em `backend/.env` defina:

```
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/postgres?connection_limit=1&sslmode=disable&pgbouncer=true
```

Para usar PostgreSQL real: `docker compose up -d db` (com `POSTGRES_PASSWORD` definido) e use a `DATABASE_URL` do `.env.example`.

```bash
npm run db:dev                # terminal 1 (somente com o banco embutido)
npm run db:deploy             # aplica as migrations
npm run db:seed               # perfis/permissões, SUPER_ADMIN e (se SEED_DEMO_DATA=true) dados demonstrativos
npm run dev                   # terminal 2 — API em http://localhost:3333
```

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

Acessos: portal `http://localhost:5173`, painel `http://localhost:5173/admin`. O e-mail/senha do SUPER_ADMIN vêm de `SEED_SUPERADMIN_EMAIL` / `SEED_SUPERADMIN_PASSWORD`. Com `SEED_DEMO_DATA=true` também são criados `admin.demo@magisterio.local` e `operador.demo@magisterio.local` (mesma senha do SUPER_ADMIN) e usuários fictícios `usuarioNN@demo.invalid` (senha de demonstração `Demo@12345`). **Nunca use `SEED_DEMO_DATA` em produção** (o seed recusa).

## Testes e build

```bash
cd backend  && npm run typecheck && npm test && npm run build
cd frontend && npm run build        # tsc + vite build
```

Os testes de API usam o banco configurado em `backend/.env` (com seed demonstrativo aplicado) e criam registros próprios.

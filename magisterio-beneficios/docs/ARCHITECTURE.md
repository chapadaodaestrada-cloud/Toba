# Arquitetura

## Estrutura

```
frontend/src/
  components/   UI reutilizável (ui, feedback, common, public)
  layouts/      PublicLayout, UserLayout, AdminLayout (identidades visuais independentes)
  pages/        public/ auth/ user/ admin/
  routes/       definição das rotas (admin carregado sob demanda)
  hooks/        autenticação (usuário e admin separados), utilidades
  services/     cliente HTTP (cookies + cabeçalho anti-CSRF)
  schemas/      validação Zod dos formulários
  types/ utils/
backend/
  prisma/       schema.prisma, migrations/, seed.ts
  src/
    config/     validação das variáveis de ambiente (Zod)
    database/   cliente Prisma
    common/     erros, helpers HTTP, utilidades, permissões (RBAC), auditoria
    middleware/ autenticação/autorização, CSRF, rate limit, tratamento de erros
    modules/    auth, users, benefits, news, applications, admins, platform (dashboard/atividades/configurações)
  scripts/      dev-db.mjs (PostgreSQL embutido p/ desenvolvimento)
  tests/        regras puras + API (supertest)
```

As migrations e o seed ficam em `backend/prisma/` (convenção do Prisma), no lugar de uma pasta `database/` separada.

## Camadas

Rotas (HTTP + validação Zod) → serviços com regra de negócio (ex.: `applications.service.ts` com o fluxo de situações) → Prisma. Componentes React só apresentam dados; regras ficam no backend.

## Autenticação e autorização

- Dois cookies httpOnly independentes: `mb_user` (7 dias) e `mb_admin` (8 h), JWT assinado com segredos distintos; sessão de usuário nunca vale como admin.
- A cada requisição o backend recarrega o usuário/admin do banco: desativações e mudanças de permissão valem imediatamente.
- RBAC: tabelas `Role`, `Permission`, `RolePermission`. Cada rota admin usa `requireAdmin('<permissão>')`. O frontend só esconde menus (UX); a decisão é sempre do servidor.
- Bloqueio de conta por 15 min após 5 senhas erradas + rate limit por IP nas rotas de login. Mensagem de erro genérica (sem enumeração de contas). Logs de autenticação em `AuthLog` (sem senha/CPF).
- CSRF: cookies `SameSite=Lax` + exigência do cabeçalho `X-Requested-With: magisterio-web` em toda mutação.

## Fluxo de solicitações

`PENDENTE → EM_ANALISE | AGUARDANDO_DOCUMENTACAO | APROVADA | RECUSADA`; `EM_ANALISE → AGUARDANDO_DOCUMENTACAO | APROVADA | RECUSADA`; `AGUARDANDO_DOCUMENTACAO → EM_ANALISE | RECUSADA`; `APROVADA → CONCLUIDA`. `RECUSADA` e `CONCLUIDA` são finais. Recusar e pedir documentação exigem justificativa. Toda alteração grava `ApplicationHistory` (de/para, autor, data). Observações podem ser internas (invisíveis ao usuário). Quando o usuário envia documento em `AGUARDANDO_DOCUMENTACAO`, a solicitação volta a `EM_ANALISE`.

## Documentos e dados pessoais

Uploads em memória → validação de assinatura real do arquivo (PDF/JPG/PNG) → gravação com nome aleatório fora de qualquer pasta pública (`UPLOAD_DIR`). Download só via API autenticada (dono ou admin com `applications:read`); o acesso do admin é auditado. Listagens administrativas mascaram o CPF.

## Auditoria

`AdminActivity` é gravada pelo backend em cada ação administrativa; não existe endpoint de escrita/edição/remoção. Somente leitura para quem tem `activities:read`.

## Pontos de extensão

E-mail (recuperação de senha, notificações), armazenamento de arquivos/imagens (S3 ou similar) e publicação programada por job (hoje resolvida na consulta pela data) são pontos de integração futuros — veja DEPLOYMENT.md.

# API REST

Base: `/api`. JSON. Mutações exigem o cabeçalho `X-Requested-With: magisterio-web`. Erros: `{ "error": "mensagem", "code": "...", "details": { campo: [erros] } }`. Listagens: `?page=&pageSize=` → `{ items, total, page, pageSize, totalPages }`.

## Público
| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | status |
| GET | `/public/settings` | dados institucionais |
| GET | `/public/benefits?q=&category=` · `/categories` · `/:slug` | catálogo (somente publicados) |
| GET | `/public/news?category=` · `/categories` · `/:slug` | notícias publicadas |

## Usuário (cookie `mb_user`)
| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/register` · `/auth/login` · `/auth/logout` | cadastro, login, logout |
| GET | `/auth/me` | sessão atual |
| POST | `/auth/forgot-password` · `/auth/reset-password` | recuperação (envio de e-mail não configurado) |
| GET/PUT | `/me/profile` · PUT `/me/profile/password` · GET `/me/profile/dashboard` | perfil e resumo |
| GET/POST | `/me/applications` · GET `/:id` · GET `/history/all` | solicitações |
| POST/GET | `/me/applications/:id/documents[/:docId]` | anexar (multipart `file`) / baixar |

## Administração (cookie `mb_admin`) — permissão exigida
| Rota | Permissão |
|---|---|
| POST `/admin/auth/login` · `/logout` · GET `/me` · recuperação de senha | — |
| GET `/admin/dashboard` | qualquer admin (atividades exigem `activities:read`) |
| `/admin/users` (GET lista/detalhe; PUT; POST `/:id/active`) | `users:read` / `users:write` |
| `/admin/benefits` (CRUD, `/:id/publish`, `/:id/unpublish`, `/categories`) | `benefits:read` / `benefits:write` |
| `/admin/applications` (GET; POST `/:id/status`, `/:id/notes`; GET `/:id/documents/:docId`) | `applications:read` / `applications:review` |
| `/admin/news` (CRUD, publish/unpublish, `/categories`) | `news:read` / `news:write` |
| `/admin/admins` (CRUD, `/:id/active`, GET `/roles`, PUT `/roles/:key`) | `admins:manage` |
| GET `/admin/activities?module=` | `activities:read` |
| GET/PUT `/admin/settings` | `settings:read` / `settings:write` |

Matriz padrão: **SUPER_ADMIN** todas; **ADMIN** usuários, benefícios, solicitações, notícias, atividades; **OPERADOR** leitura de usuários/benefícios/notícias e análise de solicitações. As permissões dos perfis ADMIN e OPERADOR podem ser ajustadas em Administradores → Perfis e permissões.
